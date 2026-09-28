import { BalatroClient } from '../driver/balatro-client.js';
import { DeepSeekAgent } from './deepseek-agent.js';
import { JevAgent } from './jev-agent.js';
import { PokerEvaluator, SUIT_NAMES, getCardModifiers, RANK_ORDER } from './poker-evaluator.js';
import { JokerSorter } from './joker-sorter.js';
import { GameState, StrategicDirective } from '../types.js';
import { MemoryManager } from './memory-manager.js';
import { PLANET_HAND_MAP } from './rules.js';
import { config } from '../config.js';
import path from 'path';
import fs from 'fs';
import pc from 'picocolors';

export class CooperativeConductor {
  private client: BalatroClient;
  private deepseek: DeepSeekAgent;
  private jev: JevAgent;
  private memory: MemoryManager;
  private currentStrategy: StrategicDirective | null = null;
  private isRunning = false;
  private lastCapturedState = '';

  constructor(client: BalatroClient) {
    this.client = client;
    this.deepseek = new DeepSeekAgent();
    this.jev = new JevAgent();
    this.memory = new MemoryManager();
  }

  /**
   * Main game automation loop
   */
  async runLoop(): Promise<void> {
    this.isRunning = true;
    const stats = this.memory.getStats();
    console.log(pc.bold(pc.cyan(`\n🚀 [Conductor] 启动 DeepSeek + Jev 双脑小丑牌自主对战协同引擎...`)));
    console.log(pc.dim(`🧠 [记忆中枢] 已累计进化 ${stats.totalRuns} 轮 | 历史最佳: 底注 ${stats.bestAnte} (最高分: ${stats.bestScore}) | 沉淀教训 ${stats.lessonsCount} 条\n`));

    let consecutiveErrors = 0;

    while (this.isRunning) {
      try {
        const state = await this.client.getGameState();
        consecutiveErrors = 0;

        if (state.state !== this.lastCapturedState) {
          this.lastCapturedState = state.state;
          // Capture snapshot on state switch
          await this.captureSnapshot(state.state);
        }

        await this.handleState(state);
      } catch (err: any) {
        consecutiveErrors++;
        console.warn(pc.yellow(`[Conductor] 状态循环异常 (${consecutiveErrors}/10): ${err.message}`));
        if (consecutiveErrors >= 10) {
          console.error(pc.red('[Conductor] 连续多次失联，尝试重新连接游戏...'));
          await this.client.ensureReady();
          consecutiveErrors = 0;
        }
      }

      await new Promise(r => setTimeout(r, config.stepDelayMs));
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private async captureSnapshot(_tag: string): Promise<void> {
    try {
      const artifactDir = 'C:\\Users\\chuzo\\.gemini\\antigravity\\brain\\5776a632-8f0b-48dc-8f18-1a45c12e4626';
      const localDir = path.resolve('screenshots');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const localFile = path.join(localDir, 'latest.png');
      const artifactFile = path.join(artifactDir, 'balatro_screen.png');

      await this.client.takeScreenshot(localFile);
      if (fs.existsSync(localFile)) {
        fs.copyFileSync(localFile, artifactFile);
      }
    } catch {
      // Ignore background screenshot failures
    }
  }

  private async handleState(state: GameState): Promise<void> {
    switch (state.state) {
      case 'MENU':
        await this.handleMenu(state);
        break;

      case 'BLIND_SELECT':
        await this.handleBlindSelect(state);
        break;

      case 'SELECTING_HAND':
        await this.handleSelectingHand(state);
        break;

      case 'ROUND_EVAL':
        await this.handleRoundEval(state);
        break;

      case 'SHOP':
        await this.handleShop(state);
        break;

      case 'BUFFOON_PACK':
      case 'TAROT_PACK':
      case 'PLANET_PACK':
      case 'STANDARD_PACK':
      case 'SPECTRAL_PACK':
        await this.handlePack(state);
        break;

      case 'GAME_OVER':
        await this.handleGameOver(state);
        break;

      case 'HAND_PLAYED':
      case 'DRAW_TO_HAND':
        // Wait for Balatro animation to settle
        await new Promise(r => setTimeout(r, 1000));
        break;

      default:
        // Transitional or animation states
        break;
    }
  }

  private async handleMenu(_state: GameState): Promise<void> {
    console.log(pc.magenta('🎮 [Menu] 检测到主菜单，正在自动发起全新标准对局 (红牌组 + 白注难度)...'));
    await this.client.startRun('RED', 'WHITE');
    console.log(pc.green('✓ [Menu] 对局成功开启，等待进入盲注选择...'));
    await new Promise(r => setTimeout(r, 2000));
  }

  private async handleBlindSelect(state: GameState): Promise<void> {
    const boss = state.blinds?.boss;
    // Inject historical lessons & boss counter memory into DeepSeek formulation
    const historicalContext = this.memory.getStrategicContext(boss?.name);
    this.currentStrategy = await this.deepseek.formulateStrategy(state, historicalContext);

    const small = state.blinds?.small;
    const big = state.blinds?.big;

    const targetBlind = small?.status === 'SELECT' ? small : (big?.status === 'SELECT' ? big : boss);
    const targetScore = targetBlind?.score || 300;

    console.log(pc.bold(pc.blue(`\n════════════════════════════════════════════════════════════════`)));
    console.log(pc.bold(pc.cyan(`🎯 [底注 ${state.ante_num} / 8] 当前选关: ${targetBlind?.name || '未知盲注'} (目标: ${targetScore} 筹码)`)));
    console.log(pc.green(`💡 [DeepSeek 宏观战略] ${this.currentStrategy.advice}`));
    if (this.currentStrategy.primaryHandType) {
      console.log(pc.bold(pc.magenta(`🔥 [单一核心引擎] 锁定主力牌型: 【${this.currentStrategy.primaryHandType}】 (集中倾斜星球/塔罗/手牌强化)`)));
    }
    console.log(pc.yellow(`📊 [构筑方向] 目标牌型: ${this.currentStrategy.targetHandTypes.join(', ')} | 理财: ${this.currentStrategy.economyGoal}`));
    if (this.currentStrategy.engineStatus) {
      console.log(pc.dim(`⚙️ [三位一体诊断] 筹码: ${this.currentStrategy.engineStatus.hasChips ? '✅' : '❌'} | +Mult: ${this.currentStrategy.engineStatus.hasFlatMult ? '✅' : '❌'} | xMult: ${this.currentStrategy.engineStatus.hasXMult ? '✅' : '❌'} (${this.currentStrategy.engineStatus.missingPiece})`));
    }
    if (this.currentStrategy.bossAlert) {
      console.log(pc.red(`🚨 [BOSS 预警] ${this.currentStrategy.bossAlert}`));
    }
    console.log(pc.bold(pc.blue(`════════════════════════════════════════════════════════════════\n`)));

    // Choose to select blind
    await this.client.selectBlind();
    console.log(pc.green(`✓ [Blind] 选定挑战 ${targetBlind?.name || '盲注'}，发牌就位！`));
    await new Promise(r => setTimeout(r, 1500));
  }

  /**
   * Check and automatically use advantageous consumables (Planet cards, Tarot cards, Spectral cards)
   */
  private async checkAndUseConsumables(state: GameState, phase: 'SHOP' | 'SELECTING_HAND'): Promise<boolean> {
    const consumables = state.consumables || (state as any).consumeables;
    if (!consumables?.cards || consumables.cards.length === 0) return false;

    const jokersCount = state.jokers?.count || 0;
    const jokersLimit = state.jokers?.limit || 5;
    const consCount = consumables?.cards?.length || 0;
    const consLimit = consumables?.limit || 2;

    for (let i = 0; i < consumables.cards.length; i++) {
      const c = consumables.cards[i];
      const key = (c.key || c.label || '').toLowerCase();
      const set = (c.set || '').toLowerCase();

      // ─────────────────────────────────────────────────────────────
      // 1. Spectral Cards (Instant & Safe Triggers in SHOP & SELECTING_HAND)
      // ─────────────────────────────────────────────────────────────
      // Black Hole: Upgrades ALL poker hands by +1! (God tier, use instantly!)
      if (key.includes('black_hole') || key.includes('black hole')) {
        console.log(pc.bold(pc.magenta(`🌌 [使用幻灵卡] 立即使用黑洞 [Black Hole]！全部 12 种牌型等级永久 +1！`)));
        try {
          await this.client.use(i);
          await new Promise(r => setTimeout(r, 1200));
          return true;
        } catch (e: any) {
          console.warn(pc.yellow(`[Spectral] 使用黑洞失败: ${e.message}`));
        }
      }

      // The Soul: Creates a Legendary Joker!
      if (key.includes('soul')) {
        if (jokersCount < jokersLimit) {
          console.log(pc.bold(pc.magenta(`✨ [使用幻灵卡] 立即使用灵魂 [The Soul]！免费召唤传奇稀有小丑！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      // Ankh: Copies 1 random Joker, destroys all others.
      // SAFE ONLY WHEN jokersCount === 1!
      if (key.includes('ankh')) {
        if (jokersCount === 1 && jokersLimit >= 2) {
          console.log(pc.bold(pc.yellow(`⚓ [使用幻灵卡] 独苗复制！使用铁锚 [Ankh] 完美复制唯一核心小丑且零损耗！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      // Hex: Adds Polychrome (x1.5 Mult) to random Joker, destroys all others.
      // SAFE ONLY WHEN jokersCount === 1!
      if (key.includes('hex')) {
        if (jokersCount === 1) {
          console.log(pc.bold(pc.yellow(`🔮 [使用幻灵卡] 单卡镀彩！使用妖术 [Hex] 为唯一核心小丑附加双色(x1.5 Mult)！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      // Wraith: Creates random Rare Joker, sets money to $0.
      if (key.includes('wraith')) {
        if (state.money <= 4 && jokersCount < jokersLimit) {
          console.log(pc.bold(pc.yellow(`👻 [使用幻灵卡] 资金见底破局！使用死灵 [Wraith] 免费抽取强力稀有小丑！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 2. Planet Cards: ALWAYS USE IMMEDIATELY (both SHOP and SELECTING_HAND)
      // ─────────────────────────────────────────────────────────────
      const isPlanet = set === 'planet' || PLANET_HAND_MAP[c.key || ''] !== undefined || PLANET_HAND_MAP[c.label || ''] !== undefined;

      if (isPlanet) {
        const handName = PLANET_HAND_MAP[c.key || ''] || PLANET_HAND_MAP[c.label || ''] || '专属牌型';
        console.log(pc.bold(pc.magenta(`🪐 [使用道具] 立即使用星球牌 [${c.label || c.key}]，永久提升【${handName}】基础等级！`)));
        try {
          await this.client.use(i);
          await new Promise(r => setTimeout(r, 1200));
          return true;
        } catch (e: any) {
          console.warn(pc.yellow(`[Consumable] 使用星球牌失败: ${e.message}`));
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 3. Direct Tarot Cards (no target required)
      // ─────────────────────────────────────────────────────────────
      if (key.includes('hermit')) {
        console.log(pc.bold(pc.yellow(`💰 [使用道具] 使用塔罗牌 [The Hermit]，金币翻倍！`)));
        try {
          await this.client.use(i);
          await new Promise(r => setTimeout(r, 1200));
          return true;
        } catch {}
      }

      if (key.includes('temperance')) {
        console.log(pc.bold(pc.yellow(`💰 [使用道具] 使用塔罗牌 [Temperance]，兑现小丑牌出售收益！`)));
        try {
          await this.client.use(i);
          await new Promise(r => setTimeout(r, 1200));
          return true;
        } catch {}
      }

      if (key.includes('high_priestess') || key.includes('high priestess')) {
        if (consCount < consLimit) {
          console.log(pc.bold(pc.cyan(`🪐 [使用道具] 使用塔罗牌 [The High Priestess]，召唤 2 张随机星球牌！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      if (key.includes('emperor')) {
        if (consCount < consLimit) {
          console.log(pc.bold(pc.cyan(`📜 [使用道具] 使用塔罗牌 [The Emperor]，召唤 2 张随机塔罗牌！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      if (key.includes('fool')) {
        if (consCount < consLimit) {
          console.log(pc.bold(pc.cyan(`🃏 [使用道具] 使用塔罗牌 [The Fool]，复制上一张使用的强力消耗卡！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      if (key.includes('judgement') || key.includes('judgment')) {
        if (jokersCount < jokersLimit) {
          console.log(pc.bold(pc.cyan(`🃏 [使用道具] 使用塔罗牌 [Judgment]，免费召唤一张小丑牌！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      if (key.includes('wheel_of_fortune') || key.includes('wheel of fortune')) {
        if (jokersCount > 0) {
          console.log(pc.bold(pc.cyan(`🎡 [使用道具] 使用塔罗牌 [Wheel of Fortune]，尝试为小丑牌镀金！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 4. Target-based Spectrals & Tarots (in SELECTING_HAND with hand cards)
      // ─────────────────────────────────────────────────────────────
      if (phase === 'SELECTING_HAND' && state.hand?.cards?.length) {
        const handCards = state.hand.cards;
        const sortedIndices = handCards
          .map((card, idx) => ({ idx, order: RANK_ORDER[card.value?.rank || '2'] || 0, mod: getCardModifiers(card) }))
          .sort((a, b) => b.order - a.order);

        const highestIdx = sortedIndices[0].idx;
        const lowestIdx = sortedIndices[sortedIndices.length - 1].idx;

        // Immolate: Destroys 5 random cards, gives $20
        if (key.includes('immolate') && handCards.length >= 5 && (state.ante_num || 1) <= 6) {
          console.log(pc.bold(pc.red(`🔥 [使用幻灵卡] 使用献祭 [Immolate]！精简手牌并立刻获取 $20 巨款！`)));
          try {
            await this.client.use(i);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Deja Vu: Red Seal (retrigger) to highest card
        if (key.includes('deja_vu') || key.includes('deja vu')) {
          console.log(pc.bold(pc.magenta(`🔴 [使用幻灵卡] 使用既视感 [Deja Vu]，为最高点牌附加红色蜡封(重复计分)！`)));
          try {
            await this.client.use(i, [highestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Trance: Blue Seal (creates Planet) to a card
        if (key.includes('trance')) {
          console.log(pc.bold(pc.cyan(`🔵 [使用幻灵卡] 使用恍惚 [Trance]，附加蓝色蜡封(留手自造专属星球牌)！`)));
          try {
            await this.client.use(i, [lowestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Medium: Purple Seal (creates Tarot on discard) to lowest junk card
        if (key.includes('medium')) {
          console.log(pc.bold(pc.magenta(`🟣 [使用幻灵卡] 使用通灵 [Medium]，为杂牌附加紫色蜡封(弃牌白嫖塔罗牌)！`)));
          try {
            await this.client.use(i, [lowestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Talisman: Gold Seal (+$3 on scoring)
        if (key.includes('talisman')) {
          console.log(pc.bold(pc.yellow(`🟡 [使用幻灵卡] 使用护身符 [Talisman]，为核心牌附加金色蜡封(计分+$3)！`)));
          try {
            await this.client.use(i, [highestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Aura: Foil, Holo, or Polychrome to 1 card
        if (key.includes('aura')) {
          console.log(pc.bold(pc.magenta(`🌈 [使用幻灵卡] 使用灵气 [Aura]，为最高点牌镀上闪箔/镭射/双色！`)));
          try {
            await this.client.use(i, [highestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Cryptid: Create 2 copies of 1 card
        if (key.includes('cryptid')) {
          const steelCard = sortedIndices.find(x => x.mod.isSteel);
          const glassCard = sortedIndices.find(x => x.mod.isGlass);
          const bestCopyIdx = steelCard ? steelCard.idx : (glassCard ? glassCard.idx : highestIdx);
          console.log(pc.bold(pc.magenta(`👥 [使用幻灵卡] 使用密室 [Cryptid]，复制 2 张最强核心牌放入卡组！`)));
          try {
            await this.client.use(i, [bestCopyIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Death: Converts left card into right card!
        if (key.includes('death')) {
          const targetJunk = lowestIdx;
          const targetHero = highestIdx;
          if (targetJunk !== targetHero) {
            console.log(pc.bold(pc.red(`💀 [使用道具] 使用塔罗牌 [Death]，将杂牌转化为高点数/强化牌副本！`)));
            try {
              await this.client.use(i, [targetJunk, targetHero]);
              await new Promise(r => setTimeout(r, 1200));
              return true;
            } catch {}
          }
        }

        // The Devil: Gold Card
        if (key.includes('devil')) {
          const target = handCards.findIndex(cd => !getCardModifiers(cd).isGold);
          const targetIdx = target >= 0 ? target : 0;
          console.log(pc.bold(pc.yellow(`✨ [使用道具] 使用塔罗牌 [The Devil]，强化黄金卡！`)));
          try {
            await this.client.use(i, [targetIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // The Empress: Mult (+4 Mult)
        if (key.includes('empress')) {
          const targets = sortedIndices.slice(0, 2).map(x => x.idx);
          console.log(pc.bold(pc.green(`✨ [使用道具] 使用塔罗牌 [The Empress]，强化 2 张倍率卡(+4 Mult)！`)));
          try {
            await this.client.use(i, targets);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // The Hierophant: Bonus (+30 Chips)
        if (key.includes('hierophant')) {
          const targets = sortedIndices.slice(0, 2).map(x => x.idx);
          console.log(pc.bold(pc.blue(`✨ [使用道具] 使用塔罗牌 [The Hierophant]，强化 2 张筹码卡(+30 Chips)！`)));
          try {
            await this.client.use(i, targets);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // The Chariot: Steel (x1.5 Mult in hand)
        if (key.includes('chariot')) {
          console.log(pc.bold(pc.cyan(`🛡️ [使用道具] 使用塔罗牌 [The Chariot]，强化钢铁卡 (手持提供 x1.5 Mult)！`)));
          try {
            await this.client.use(i, [lowestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // The Magician: Lucky Card
        if (key.includes('magician')) {
          const targets = sortedIndices.slice(0, 2).map(x => x.idx);
          console.log(pc.bold(pc.cyan(`🍀 [使用道具] 使用塔罗牌 [The Magician]，强化 2 张幸运卡！`)));
          try {
            await this.client.use(i, targets);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Justice: Glass Card (x2 Mult)
        if (key.includes('justice')) {
          console.log(pc.bold(pc.cyan(`💎 [使用道具] 使用塔罗牌 [Justice]，强化玻璃卡 (x2 Mult)！`)));
          try {
            await this.client.use(i, [highestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // The Lovers: Wild Card
        if (key.includes('lovers')) {
          console.log(pc.bold(pc.magenta(`❤️ [使用道具] 使用塔罗牌 [The Lovers]，将手牌强化为万能百搭卡！`)));
          try {
            await this.client.use(i, [highestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // The Tower: Stone Card (+50 Chips)
        if (key.includes('tower')) {
          console.log(pc.bold(pc.dim(`🗿 [使用道具] 使用塔罗牌 [The Tower]，将低点废牌转化为石头卡(+50 Chips)！`)));
          try {
            await this.client.use(i, [lowestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Strength: Rank +1
        if (key.includes('strength')) {
          const targets = sortedIndices.filter(x => x.order < 14).slice(0, 2).map(x => x.idx);
          console.log(pc.bold(pc.yellow(`💪 [使用道具] 使用塔罗牌 [Strength]，手牌点数+1！`)));
          try {
            await this.client.use(i, targets.length > 0 ? targets : [highestIdx]);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // The Hanged Man: Destroy 2 lowest junk cards
        if (key.includes('hanged_man') || key.includes('hanged man')) {
          const targets = sortedIndices.slice(-2).map(x => x.idx);
          console.log(pc.bold(pc.red(`🗑️ [使用道具] 使用塔罗牌 [The Hanged Man]，撕毁 2 张低点杂牌精简牌组！`)));
          try {
            await this.client.use(i, targets);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }

        // Suit Changers: Star (Diamonds), Moon (Clubs), Sun (Hearts), World (Spades)
        if (key.includes('star') || key.includes('moon') || key.includes('sun') || key.includes('world')) {
          const targets = [0, 1, 2].filter(idx => idx < handCards.length);
          console.log(pc.bold(pc.magenta(`🎨 [使用道具] 使用花色转换塔罗牌，统一手牌花色冲刺同花！`)));
          try {
            await this.client.use(i, targets);
            await new Promise(r => setTimeout(r, 1200));
            return true;
          } catch {}
        }
      }
    }

    return false;
  }

  private async handleSelectingHand(state: GameState): Promise<void> {
    const cards = state.hand?.cards || [];
    if (cards.length === 0) return;

    // Check and use any beneficial consumables (Planet level-ups, Tarot enhancements)
    const usedConsumable = await this.checkAndUseConsumables(state, 'SELECTING_HAND');
    if (usedConsumable) {
      return; // Consumable used, let next tick process newly enhanced cards
    }

    if (!this.currentStrategy) {
      const historicalContext = this.memory.getStrategicContext(state.blinds?.boss?.name);
      this.currentStrategy = await this.deepseek.formulateStrategy(state, historicalContext);
    }

    const currentScore = state.round?.chips || 0;
    // Determine target score from current blind
    const small = state.blinds?.small;
    const big = state.blinds?.big;
    const boss = state.blinds?.boss;
    const targetScore = (small?.status === 'CURRENT' ? small.score : undefined)
      || (big?.status === 'CURRENT' ? big?.score : undefined)
      || (boss?.status === 'CURRENT' ? boss?.score : undefined)
      || (state.round as any)?.chips_to_win
      || 300;

    // 【每关前十秒检查法】：
    // 1. 检查并物理重排小丑从左到右顺序：[经济/功能] -> [+Chips] -> [+Mult] -> [xMult最右端]
    const jokers = state.jokers?.cards || [];
    if (jokers.length > 1) {
      const sortResult = JokerSorter.getOptimalOrder(jokers);
      if (sortResult.needsRearrange) {
        console.log(pc.bold(pc.magenta(`🔀 [小丑物理重排] 检测到非最优摆放！自动优化排列小丑顺序 (左加算 -> 右乘算):`)));
        console.log(pc.cyan(`   最优顺序: ${sortResult.description}`));
        try {
          await this.client.rearrangeJokers(sortResult.newOrder);
          await new Promise(r => setTimeout(r, 600));
        } catch (e: any) {
          console.warn(pc.yellow(`[JokerSorter] 重排小丑提示: ${e.message}`));
        }
      }
    }

    // 2. BOSS 特殊词条读数预警
    if (boss?.status === 'CURRENT' && boss.effect) {
      console.log(pc.bold(pc.red(`🚨 [BOSS 限制生效中] ${boss.name}: ${boss.effect} (注意避开克制花色/点数！)`)));
    }

    // Print Hand Cards cleanly
    const cardStr = cards.map((c, i) => `[${i}] ${c.value?.rank || '?'}${SUIT_NAMES[c.value?.suit || 'S'] || ''}`).join('  ');
    console.log(pc.dim(`🎴 当前手牌 (${cards.length}张): ${cardStr}`));
    console.log(pc.dim(`📊 进度: ${currentScore} / ${targetScore} 筹码 | 剩余出牌: ${state.round?.hands_left} 次 | 剩余弃牌: ${state.round?.discards_left} 次`));

    // Generate ranked tactical candidates (aligned with primaryHandType and held Steel cards)
    const candidates = PokerEvaluator.generateCandidates(
      cards,
      state.round?.hands_left || 1,
      state.round?.discards_left || 0,
      targetScore,
      currentScore,
      state.hands,
      this.currentStrategy?.primaryHandType
    );

    // Let Jev System 1 make the tactical choice
    const decision = await this.jev.decideHandAction(state, candidates, this.currentStrategy, targetScore);

    if (decision.action === 'play') {
      const playedCards = decision.params.cards as number[];
      const names = playedCards.map(i => `${cards[i]?.value?.rank || '?'}${SUIT_NAMES[cards[i]?.value?.suit || 'S'] || ''}`).join(' ');
      console.log(pc.bold(pc.green(`⚔️ [Jev 出牌] 打出: [ ${names} ]`)));
      console.log(pc.dim(`   理由: ${decision.reason} (置信度: ${(decision.confidence * 100).toFixed(0)}%)`));
      await this.client.playCards(playedCards);
      await new Promise(r => setTimeout(r, 1600));
    } else if (decision.action === 'discard') {
      const discardCards = decision.params.cards as number[];
      const names = discardCards.map(i => `${cards[i]?.value?.rank || '?'}${SUIT_NAMES[cards[i]?.value?.suit || 'S'] || ''}`).join(' ');
      console.log(pc.bold(pc.yellow(`🔄 [Jev 弃牌] 弃掉: [ ${names} ]`)));
      console.log(pc.dim(`   理由: ${decision.reason} (置信度: ${(decision.confidence * 100).toFixed(0)}%)`));
      await this.client.discardCards(discardCards);
      await new Promise(r => setTimeout(r, 1400));
    }
  }

  private async handleRoundEval(state: GameState): Promise<void> {
    console.log(pc.bold(pc.green(`🎉 [Round Clear] 回合胜利！总得分: ${state.round?.chips || 0}！正在提现奖金...`)));
    await this.client.cashOut();
    console.log(pc.green(`✓ [Cash Out] 提现成功，进入商店阶段！`));
    await new Promise(r => setTimeout(r, 1500));
  }

  private async handleShop(state: GameState): Promise<void> {
    // Check if any Planet or money Tarot cards can be used right away in shop
    const usedConsumable = await this.checkAndUseConsumables(state, 'SHOP');
    if (usedConsumable) {
      return;
    }

    if (!this.currentStrategy) {
      const historicalContext = this.memory.getStrategicContext(state.blinds?.boss?.name);
      this.currentStrategy = await this.deepseek.formulateStrategy(state, historicalContext);
    }

    const money = state.money || 0;
    const cards = state.shop?.cards || [];
    const packs = state.shop?.packs || [];
    const vouchers = state.shop?.vouchers || [];

    const consumables = state.consumables || (state as any).consumeables;
    const consCount = consumables?.count ?? 0;
    const consLimit = consumables?.limit ?? 2;

    console.log(pc.bold(pc.cyan(`\n🏬 [Shop 商店阶段] 资金: $${money} | 小丑: ${state.jokers?.count || 0}/${state.jokers?.limit || 5} | 道具: ${consCount}/${consLimit}`)));
    if (cards.length > 0) {
      console.log(pc.dim(`   在售卡牌: ${cards.map(c => `${c.label || c.key}($${c.cost?.buy ?? 4})`).join(', ')}`));
    }
    if (packs.length > 0) {
      console.log(pc.dim(`   在售卡包: ${packs.map(p => `${p.label || p.key}($${p.cost?.buy ?? 4})`).join(', ')}`));
    }
    if (vouchers.length > 0) {
      console.log(pc.dim(`   在售优惠券: ${vouchers.map(v => `${v.label || v.key}($${v.cost?.buy ?? 10})`).join(', ')}`));
    }

    const decision = await this.jev.decideShopAction(state, this.currentStrategy);

    if (decision.action === 'replace_joker') {
      console.log(pc.bold(pc.magenta(`🔄 [Jev 换牌] ${decision.reason}`)));
      try {
        await this.client.sellJoker(decision.params.sellJoker);
        await new Promise(r => setTimeout(r, 800));
        await this.client.buy({ card: decision.params.buyCard });
        await new Promise(r => setTimeout(r, 1200));
      } catch (err: any) {
        console.warn(pc.yellow(`⚠️ [Jev 换牌] 换牌执行异常: ${err.message}，停止换牌并离店`));
        await this.client.nextRound();
      }
      await new Promise(r => setTimeout(r, 1200));
    } else if (decision.action === 'buy') {
      console.log(pc.bold(pc.magenta(`🛒 [Jev 选购] 执行购买: ${decision.reason}`)));
      try {
        await this.client.buy(decision.params);
      } catch (err: any) {
        console.warn(pc.yellow(`⚠️ [Jev 选购] 购买失败: ${err.message}，停止购买并离店`));
        await this.client.nextRound();
      }
      await new Promise(r => setTimeout(r, 1200));
    } else if (decision.action === 'reroll') {
      console.log(pc.bold(pc.yellow(`🎲 [Jev 刷新] 刷新货架: ${decision.reason}`)));
      try {
        await this.client.reroll();
      } catch (err: any) {
        console.warn(pc.yellow(`⚠️ [Jev 刷新] 刷新失败: ${err.message}，停止刷新并离店`));
        await this.client.nextRound();
      }
      await new Promise(r => setTimeout(r, 1200));
    } else {
      console.log(pc.bold(pc.blue(`🚪 [Jev 离店] ${decision.reason}`)));
      await this.client.nextRound();
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  private async handlePack(state: GameState): Promise<void> {
    console.log(pc.cyan(`🎁 [Pack] 打开卡包中，自动挑选高价值卡牌...`));
    try {
      const handCount = state.hand?.cards?.length || 0;
      const targets = handCount > 0 ? [0] : undefined;
      await this.client.selectPackCard(0, targets);
    } catch {
      await this.client.skipPack();
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  private async handleGameOver(state: GameState): Promise<void> {
    console.log(pc.bold(pc.red(`\n💀 [Game Over] 本轮挑战结束！`)));
    console.log(pc.yellow(`📊 战绩统计: 到达底注 ${state.ante_num} | 通关回合 ${state.round_num} | 累计金币 $${state.money}`));

    const targetScore = (state.round as any)?.chips_to_win || state.blinds?.boss?.score || 300;
    const finalScore = state.round?.chips || 0;
    const jokers = state.jokers?.cards?.map(j => j.label || j.key || 'Unknown') || [];
    const bossName = state.blinds?.boss?.name;

    console.log(pc.bold(pc.magenta('🤔 [复盘反思中枢] DeepSeek 正在启动战后深度复盘与教训总结...')));
    const reflection = await this.deepseek.reflectOnRun(state, this.currentStrategy, targetScore, finalScore);

    console.log(pc.bold(pc.red(`🔍 [死因诊断] ${reflection.rootCause}`)));
    console.log(pc.bold(pc.yellow(`💡 [沉淀血泪教训] ${reflection.lesson}`)));
    if (reflection.bossCounter) {
      console.log(pc.cyan(`🛡️ [BOSS 破解备忘] ${reflection.bossCounter}`));
    }

    this.memory.recordRun(
      reflection,
      state.ante_num || 1,
      state.round_num || 1,
      state.money || 0,
      finalScore,
      targetScore,
      jokers,
      bossName
    );

    const stats = this.memory.getStats();
    console.log(pc.dim(`📈 [经验记忆中枢] 累计对局: ${stats.totalRuns} 轮 | 历史最佳纪录: 底注 ${stats.bestAnte} (最高分: ${stats.bestScore})\n`));

    console.log(pc.cyan('🔄 正在返回主菜单并开启新一轮征途...\n'));
    await new Promise(r => setTimeout(r, 2000));
    try {
      await this.client.returnToMenu();
    } catch (e: any) {
      console.warn(pc.yellow(`[Conductor] 返回主菜单提示: ${e.message}`));
    }
    await new Promise(r => setTimeout(r, 1500));
    await this.client.startRun('RED', 'WHITE');
    await new Promise(r => setTimeout(r, 2000));
  }
}

import { TypeSafeClient, choice } from '@typesafe-ai/sdk';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { config } from '../config.js';
import { ActionDecision, GameState, HandCandidate, StrategicDirective } from '../types.js';
import { PLANET_HAND_MAP } from './rules.js';
import pc from 'picocolors';

export class JevAgent {
  private client: TypeSafeClient;
  private apiKey: string;

  constructor(apiKey = config.typesafeApiKey, proxyUrl = config.jevProxyUrl) {
    this.apiKey = apiKey;

    if (proxyUrl) {
      console.log(pc.cyan(`🌐 [Jev 代理网络] 启用专属代理通道: ${proxyUrl}`));
      const agent = new ProxyAgent(proxyUrl);
      const proxiedFetch = (input: any, init?: any) => {
        return undiciFetch(input, {
          ...init,
          dispatcher: agent,
        }) as unknown as Promise<Response>;
      };
      this.client = new TypeSafeClient({ apiKey, fetch: proxiedFetch });
    } else {
      console.log(pc.dim(`🌐 [Jev 代理网络] 未配置代理，走本地直连`));
      this.client = new TypeSafeClient({ apiKey });
    }
  }

  /**
   * Decide between playing cards or discarding cards during SELECTING_HAND
   */
  async decideHandAction(
    state: GameState,
    candidates: HandCandidate[],
    strategy: StrategicDirective,
    targetScore: number
  ): Promise<ActionDecision> {
    if (candidates.length === 0) {
      throw new Error('No valid hand candidates available!');
    }

    const top = candidates[0];
    const scoreRemaining = Math.max(0, targetScore - (state.round?.chips || 0));

    // Tactical Fast-Path:
    // If top candidate guarantees 1-shot victory, execute immediately!
    if (top.type === 'play' && top.estimatedScore && top.estimatedScore >= scoreRemaining) {
      return {
        action: 'play',
        params: { cards: top.cardIndices },
        reason: `[战术直觉] ${top.reason}`,
        confidence: 1.0,
        source: 'tactical_fast_path',
      };
    }

    // Build choices for Jev System 1
    const choicesMap: Record<string, string> = {};
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const actionName = c.type === 'play' ? '【出牌】' : '【弃牌】';
      choicesMap[`opt_${i}`] = `${actionName} [${c.cardsSummary}] - ${c.reason}`;
    }

    try {
      const prompt = `你正在操盘《小丑牌》(Balatro)。
【计分法则】：最终得分 = 基础+成牌卡牌筹码(Chips) × 牌型倍率(Mult)。仅成牌卡牌加单牌筹码，废牌不算分。
当前战局：
- 目标筹码差额：还需 ${scoreRemaining} 筹码通关
- 剩余出牌次数：${state.round?.hands_left} 次，剩余弃牌次数：${state.round?.discards_left} 次
- DeepSeek 宏观战略指导：${strategy.advice} | 优先牌型: ${strategy.targetHandTypes.join('/')}
- BOSS 警报：${strategy.bossAlert || '无'}

请依据当前出牌/弃牌战术候选选项，以最佳胜率直觉选出最果断、收益最高的单个操作代码。`;

      const response = await this.client.systemOne({
        state: {
          game: 'Balatro',
          ante: state.ante_num,
          round: state.round_num,
          scoreRemaining,
          handsLeft: state.round?.hands_left,
          discardsLeft: state.round?.discards_left,
          currentJokers: state.jokers?.cards?.map(j => j.label || j.key).join(', ') || '无',
          strategicDirective: strategy.advice,
        },
        questions: {
          optimalAction: choice(prompt, choicesMap),
        },
      });

      const selectedKey = response.answers.optimalAction.choice;
      const index = parseInt(selectedKey.replace('opt_', ''), 10);
      const chosen = candidates[index] || candidates[0];

      return {
        action: chosen.type,
        params: { cards: chosen.cardIndices },
        reason: `[Jev 裁决] 采纳 DeepSeek 战略并选择: ${chosen.reason}`,
        confidence: response.answers.optimalAction.confidence ?? 0.95,
        source: 'deepseek_jev_synergy',
      };
    } catch (err: any) {
      console.warn(pc.yellow(`[Jev System 1] API 调用降级 (${err.message}), 执行最佳启发式候选`));
      return {
        action: top.type,
        params: { cards: top.cardIndices },
        reason: `[启发式降级] ${top.reason}`,
        confidence: 0.85,
        source: 'heuristic_engine',
      };
    }
  }

  /**
   * Find decaying or low-value jokers that can be sold to make room for game-changing jokers
   */
  private findDisposableJoker(state: GameState): { index: number; name: string; sellPrice: number; reason: string } | null {
    const jokers = state.jokers?.cards || [];
    if (jokers.length === 0) return null;

    // 1. Decaying jokers: Ice Cream, Popcorn, Turtle Bean
    for (let i = 0; i < jokers.length; i++) {
      const j = jokers[i];
      const key = (j.key || '').toLowerCase();
      const label = (j.label || '').toLowerCase();
      const sellPrice = j.cost?.sell ?? 1;

      if (key.includes('ice_cream') || label.includes('ice cream')) {
        return { index: i, name: j.label || 'Ice Cream', sellPrice, reason: '点数持续衰减，即将报废' };
      }
      if (key.includes('popcorn') || label.includes('popcorn')) {
        return { index: i, name: j.label || 'Popcorn', sellPrice, reason: '倍率持续衰减' };
      }
      if (key.includes('turtle_bean') || label.includes('turtle bean')) {
        return { index: i, name: j.label || 'Turtle Bean', sellPrice, reason: '手牌上限持续衰减' };
      }
    }

    // 2. Pure utility jokers without scoring
    for (let i = 0; i < jokers.length; i++) {
      const j = jokers[i];
      const key = (j.key || '').toLowerCase();
      const label = (j.label || '').toLowerCase();
      const sellPrice = j.cost?.sell ?? 1;

      if (key.includes('drunkard') || label.includes('drunkard')) {
        return { index: i, name: j.label || 'Drunkard', sellPrice, reason: '仅提供+1弃牌，无直接得分收益' };
      }
      if (key.includes('luchador') || label.includes('luchador')) {
        return { index: i, name: j.label || 'Luchador', sellPrice, reason: '单次解除Boss，占用卡槽' };
      }
    }

    // 3. Low tier basic flat bonus
    for (let i = 0; i < jokers.length; i++) {
      const j = jokers[i];
      const key = (j.key || '').toLowerCase();
      const label = (j.label || '').toLowerCase();
      const sellPrice = j.cost?.sell ?? 1;

      if (key === 'j_joker' || label === 'joker') {
        return { index: i, name: j.label || 'Joker', sellPrice, reason: '基础小丑(+4 Mult)，上限极低' };
      }
    }

    return null;
  }

  /**
   * Decide shop actions (buy card/pack, reroll, or next round)
   */
  async decideShopAction(
    state: GameState,
    strategy: StrategicDirective
  ): Promise<ActionDecision> {
    const money = state.money || 0;
    const shopCards = state.shop?.cards || [];
    const shopPacks = state.shop?.packs || [];
    const shopVouchers = state.shop?.vouchers || [];
    const rerollCost = state.round?.reroll_cost || 5;

    const jokersCount = state.jokers?.count || 0;
    const jokersLimit = state.jokers?.limit || 5;
    const consumables = state.consumables || (state as any).consumeables;
    const consCount = consumables?.count ?? 0;
    const consLimit = consumables?.limit ?? 2;

    const disposable = this.findDisposableJoker(state);

    // Collect all viable shop options
    const shopOptions: { id: string; desc: string; action: 'buy' | 'reroll' | 'next_round' | 'replace_joker'; param?: any }[] = [];

    // Buy Joker / Consumable cards
    for (let i = 0; i < shopCards.length; i++) {
      const c = shopCards[i];
      const price = c.cost?.buy ?? 4;
      if (money < price) continue;

      const set = (c.set || '').toUpperCase();
      const isJoker = set === 'JOKER' || (c.key && c.key.startsWith('j_'));
      const isPlanet = set === 'PLANET' || (c.key && (PLANET_HAND_MAP[c.key] !== undefined || PLANET_HAND_MAP[c.label || ''] !== undefined));
      const isConsumable = ['TAROT', 'PLANET', 'SPECTRAL'].includes(set) || (c.key && (c.key.startsWith('c_') || c.key.startsWith('p_')));

      // Slot capacity checks:
      if (isJoker && jokersCount >= jokersLimit) {
        // Joker slots are full (5/5). Check if this card is a tier-1 / xMult game-changer and we have a disposable joker!
        const eff = c.value?.effect || '';
        const isXMult = eff.includes('X') || eff.includes('x') || eff.includes('倍率') ||
          (c.label && ['Cavendish', 'Constellation', 'Card Sharp', 'Blackboard', 'The Duo', 'The Trio', 'The Family', 'The Order', 'The Tribe', 'Baron', 'Obelisk', 'Idol'].some(name => c.label!.includes(name)));
        const isGameChanger = isXMult || (c.key && ['j_four_fingers', 'j_blueprint', 'j_brainstorm', 'j_gros_michel'].includes(c.key)) ||
          (c.label && ['Four Fingers', 'Blueprint', 'Brainstorm', 'Gros Michel'].some(name => c.label!.includes(name)));

        if (isGameChanger && disposable && (money + disposable.sellPrice >= price)) {
          shopOptions.push({
            id: `replace_joker_${i}`,
            desc: `🔄【置换弱势小丑】卖出已贬值小丑 [${disposable.name}] (${disposable.reason}，变现 $${disposable.sellPrice})，腾位换购核心神卡 [${c.label || c.key}] (花费: $${price})`,
            action: 'replace_joker',
            param: { sellJoker: disposable.index, buyCard: i },
          });
        }
        // Do not add normal jokers to options if slots are full
        continue;
      }

      if (isConsumable && consCount >= consLimit) {
        // Consumable slots are full (2/2)
        continue;
      }

      let desc = `购买卡牌 [${c.label || c.key}] (花费: $${price})`;
      if (isPlanet) {
        const planetHand = PLANET_HAND_MAP[c.key || ''] || PLANET_HAND_MAP[c.label || ''];
        if (planetHand && strategy.primaryHandType === planetHand) {
          desc += ` 👑【首选主打牌型专属星球牌: 永久升级 ${planetHand}，最高优先级必买】`;
        } else if (planetHand && strategy.targetHandTypes.includes(planetHand)) {
          desc += ` ⭐【核心流派星球牌: 永久升级 ${planetHand}，购买即生效】`;
        } else {
          desc += ` 🪐【星球牌: 永久升级手牌基础点数，购买即生效】`;
        }
      } else if (isConsumable) {
        const cKey = (c.key || c.label || '').toLowerCase();
        if (cKey.includes('hanged_man') || cKey.includes('hanged man')) {
          desc += ` ✂️【核心瘦牌神卡: 永久撕毁低点杂牌精简牌库】`;
        } else if (cKey.includes('chariot')) {
          desc += ` 🛡️【战车: 强化手持钢铁卡(x1.5 Mult爆分引擎)】`;
        } else if (cKey.includes('devil')) {
          desc += ` 💰【恶魔: 强化黄金卡持续吃利息】`;
        } else if (cKey.includes('hermit') || cKey.includes('temperance')) {
          desc += ` 💵【经济神卡: 资金翻倍/变现滚雪球】`;
        } else {
          desc += ` 📜【强力道具卡: 强化卡组/经济增益，购买即用】`;
        }
      } else if (isJoker) {
        const eff = c.value?.effect || '';
        if (eff.includes('X') || eff.includes('x') || eff.includes('倍率')) {
          desc += ` ⚡【乘法倍率 xMult 小丑: 必须置于最右端实现最终爆发】`;
        } else if (eff.includes('筹码') && strategy.engineStatus?.hasChips === false) {
          desc += ` 🧩【补齐筹码缺口: 极高即战力提升】`;
        } else if (eff.includes('+') && strategy.engineStatus?.hasFlatMult === false) {
          desc += ` 🧩【补齐加法倍率缺口: 稳固基础倍率】`;
        }
      }
      shopOptions.push({
        id: `buy_card_${i}`,
        desc,
        action: 'buy',
        param: { card: i },
      });
    }

    // Buy Packs (especially Buffoon / Celestial / Standard)
    for (let i = 0; i < shopPacks.length; i++) {
      const p = shopPacks[i];
      const price = p.cost?.buy ?? 4;
      if (money < price) continue;

      const isBuffoon = (p.key && p.key.toLowerCase().includes('buffoon')) || (p.label && p.label.toLowerCase().includes('buffoon'));
      if (isBuffoon && jokersCount >= jokersLimit) {
        // Skip Buffoon pack if joker slots are full
        continue;
      }

      let desc = `选购补充包 [${p.label || p.key}] (花费: $${price})`;
      if (isBuffoon) {
        desc += ` 🃏【小丑补充包: 极高价值必选】`;
      } else if ((p.key && p.key.toLowerCase().includes('celestial')) || (p.label && p.label.toLowerCase().includes('celestial'))) {
        desc += ` 🪐【星球包: 永久升级主力牌型】`;
      }
      shopOptions.push({
        id: `buy_pack_${i}`,
        desc,
        action: 'buy',
        param: { pack: i },
      });
    }

    // Buy Vouchers
    for (let i = 0; i < shopVouchers.length; i++) {
      const v = shopVouchers[i];
      const price = v.cost?.buy ?? 10;
      if (money >= price) {
        shopOptions.push({
          id: `buy_voucher_${i}`,
          desc: `购买特权优惠券 [${v.label || v.key}] (花费: $${price})`,
          action: 'buy',
          param: { voucher: i },
        });
      }
    }

    // Reroll option:
    // STRICT RULE:
    // 1. NEVER reroll if joker slots are full (jokersCount >= jokersLimit)!
    // 2. NEVER reroll if money would drop below the $25 interest threshold (must keep money >= rerollCost + 25)
    // 3. NEVER reroll if there is already an unbought planet card on shelf
    const hasUnboughtPlanet = shopCards.some(c => ((c.set || '').toUpperCase() === 'PLANET' || (c.key && PLANET_HAND_MAP[c.key])) && (c.cost?.buy ?? 4) <= money);
    const canReroll = (jokersCount < jokersLimit) && (money >= rerollCost + 25) && !hasUnboughtPlanet;
    if (canReroll) {
      shopOptions.push({
        id: 'reroll_shop',
        desc: `花费 $${rerollCost} 重新刷新商店货架 (剩余资金仍在 $25 以上吃满利息)`,
        action: 'reroll',
      });
    }

    // Next round (always available)
    shopOptions.push({
      id: 'leave_shop',
      desc: '结束购物，离开商店进入下一轮 (保持金币吃利息)',
      action: 'next_round',
    });

    // Fast heuristic if only next_round
    if (shopOptions.length === 1) {
      return {
        action: 'next_round',
        reason: jokersCount >= jokersLimit
          ? '小丑栏已满(5/5)且无核心卡可换，严禁盲目刷新浪费利息，果断离店'
          : '当前金币不足或无高价值商品，果断离店存钱吃利息',
        confidence: 1.0,
        source: 'tactical_fast_path',
      };
    }

    const choicesMap: Record<string, string> = {};
    for (const opt of shopOptions) {
      choicesMap[opt.id] = opt.desc;
    }

    try {
      const prompt = `你正在操盘《小丑牌》(Balatro) 的商店结算阶段。
【核心法则】：
1. 黄金利息线：每 $5 结余产生 $1 利息（最高 $25 吃满 $5 利息封顶），绝对避免盲目刷新导致存款跌破 $25。
2. 禁忌法则：小丑栏满(5/5)时严禁刷新商店，此时刷出小丑无法购买纯属浪费！
3. 消耗品优势：星球牌与塔罗牌购买后自动即时使用，不占用背包栏位，永久提升基础点数。
4. 小丑摆放：从左到右必须为【+筹码/+Mult】->【乘法倍率 xMult 置于最右】。
5. 战力置换例外：若出现【置换弱势小丑】，是用快报废的衰减小丑换入核心神卡（如 xMult 乘倍小丑或关键牌型小丑），其战力跃升远超短期利息，属于顶级必选决策！
当前金币: $${money} | 小丑数: ${state.jokers?.count || 0} / ${state.jokers?.limit || 5}
DeepSeek 战略指导: ${strategy.advice} | 构筑需求: ${strategy.jokerNeeds.join('; ')}

请在可负担的商品中，权衡即战力提升与利息储备，做出最优商品抉择：`;

      const response = await this.client.systemOne({
        state: {
          phase: 'SHOP',
          money,
          jokerCount: state.jokers?.count || 0,
          jokerNeeds: strategy.jokerNeeds.join(', '),
          directive: strategy.advice,
        },
        questions: {
          shopDecision: choice(prompt, choicesMap),
        },
      });

      const selectedId = response.answers.shopDecision.choice;
      const matched = shopOptions.find(o => o.id === selectedId) || shopOptions[shopOptions.length - 1];

      return {
        action: matched.action,
        params: matched.param,
        reason: `[Jev 商店裁决] ${matched.desc}`,
        confidence: response.answers.shopDecision.confidence ?? 0.9,
        source: 'deepseek_jev_synergy',
      };
    } catch {
      // Heuristic fallback: if we have Buffoon Pack or affordable Joker when count < limit, buy it
      const priorityCard = shopOptions.find(o => o.desc.includes('极高价值') || o.desc.includes('核心流派星球牌') || (o.id.startsWith('buy_card') && (state.jokers?.count || 0) < (state.jokers?.limit || 5)));
      if (priorityCard) {
        return {
          action: priorityCard.action,
          params: priorityCard.param,
          reason: `[启发式进货] ${priorityCard.desc}`,
          confidence: 0.85,
          source: 'heuristic_engine',
        };
      }

      return {
        action: 'next_round',
        reason: '保留资金吃利息，进入下一轮',
        confidence: 0.9,
        source: 'heuristic_engine',
      };
    }
  }
}

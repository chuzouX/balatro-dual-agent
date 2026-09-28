import OpenAI from 'openai';
import { Agent, fetch as undiciFetch } from 'undici';
import { config } from '../config.js';
import { GameState, StrategicDirective } from '../types.js';
import { BALATRO_RULEBOOK } from './rules.js';
import { RunReflection } from './memory-manager.js';
import pc from 'picocolors';

export class DeepSeekAgent {
  private client: OpenAI | null = null;
  private model: string;
  private hasKey: boolean;

  constructor() {
    this.model = config.deepseekModel;
    this.hasKey = !!config.deepseekApiKey && config.deepseekApiKey !== 'your_deepseek_api_key_here';
    if (this.hasKey) {
      if (config.deepseekDirect) {
        console.log(pc.green(`⚡ [DeepSeek 网络路由] 锁定原生高速直连 (Bypass Any Proxy)`));
        const directDispatcher = new Agent();
        const directFetch = (url: any, init?: any) => {
          return undiciFetch(url, {
            ...init,
            dispatcher: directDispatcher,
          }) as unknown as Promise<Response>;
        };
        this.client = new OpenAI({
          apiKey: config.deepseekApiKey,
          baseURL: config.deepseekBaseUrl,
          fetch: directFetch as any,
        });
      } else {
        this.client = new OpenAI({
          apiKey: config.deepseekApiKey,
          baseURL: config.deepseekBaseUrl,
        });
      }
    }
  }

  /**
   * Formulate high-level strategic directive for the run / round / shop
   */
  async formulateStrategy(state: GameState, historicalContext?: string): Promise<StrategicDirective> {
    // Fast Heuristic baseline
    const fallbackDirective = this.generateHeuristicStrategy(state);

    if (!this.hasKey || !this.client) {
      return fallbackDirective;
    }

    try {
      const small = state.blinds?.small;
      const big = state.blinds?.big;
      const boss = state.blinds?.boss;

      // Identify whether current blind is Boss Blind vs Small/Big Blind
      const isBossBlindActive = (boss?.status === 'CURRENT' || boss?.status === 'SELECT');
      const isBigBlindActive = (big?.status === 'CURRENT' || big?.status === 'SELECT');
      const currentBlindType = isBossBlindActive ? 'BOSS盲注' : (isBigBlindActive ? '大盲注 (Big Blind)' : '小盲注 (Small Blind)');
      const currentBlindScore = isBossBlindActive ? (boss?.score || 600) : (isBigBlindActive ? (big?.score || 450) : (small?.score || 300));

      const currentJokers = state.jokers?.cards?.map(j => `${j.label || j.key}`).join(', ') || '无';

      // Summarize upgraded hand levels
      const upgradedHands: string[] = [];
      if (state.hands) {
        for (const [handName, info] of Object.entries(state.hands)) {
          if (info.level > 1) {
            upgradedHands.push(`${handName} (Lv.${info.level}, ${info.chips}x${info.mult})`);
          }
        }
      }

      const memoryPromptPart = historicalContext ? `\n【历史战术备忘】\n${historicalContext}\n` : '';

      // Analyze current engine Trinity status (Chips + Flat Mult + XMult)
      const jokerCards = state.jokers?.cards || [];
      const hasChips = jokerCards.some(j => (j.value?.effect || '').includes('筹码') || (j.key || '').includes('clever') || (j.key || '').includes('ice_cream') || (j.key || '').includes('blue'));
      const hasFlatMult = jokerCards.some(j => (j.value?.effect || '').includes('+') || (j.key || '').includes('gros') || (j.key || '').includes('mystic') || (j.key || '').includes('joker'));
      const hasXMult = jokerCards.some(j => (j.value?.effect || '').includes('X') || (j.value?.effect || '').includes('x') || (j.key || '').includes('cavendish') || (j.key || '').includes('constellation'));

      let missingPieceDesc = '三位一体引擎初具雏形，急需乘法倍率(xMult)置于最右端！';
      if (!hasFlatMult) missingPieceDesc = '严重欠缺加法倍率(+Mult)，必须优先补齐+Mult小丑！';
      else if (!hasChips) missingPieceDesc = '倍率尚可但筹码(Chips)偏低，急需+Chips小丑或星球升级牌型底数！';
      else if (hasChips && hasFlatMult && hasXMult) missingPieceDesc = '三位一体核心已健全！重点寻找重复触发、第二张独立xMult或塔罗强化手牌(钢铁/玻璃)！';

      const prompt = `当前小丑牌实战对局状态与引擎诊断：
- 底注 (Ante): ${state.ante_num} / 8, 回合 (Round): ${state.round_num}
- 当前挑战关卡: 【${currentBlindType}】 (目标通关筹码: ${currentBlindScore})
- BOSS盲注信息: 【${boss?.name || '未知'}】 (效果: ${boss?.effect || '无'}, BOSS目标分: ${boss?.score || '?'})
  -> 🚨【关键判读】: ${isBossBlindActive ? '当前正是 BOSS 盲注，BOSS 词条限制正在生效！请针对性给出破局指令！' : '【普通小盲/大盲阶段，BOSS 词条完全未生效！】小盲大盲没有任何负面词条限制，当前首要任务是打出最高分过关赚取奖金并进入商店，【绝对严禁】因顾虑未来BOSS而在小盲大盲打废牌或放水自杀！'}
- 当前金币: $${state.money} (利息机制：持满 $25 吃满每回合 $5 利息封顶)
- 当前小丑牌 (Jokers): ${currentJokers} (${state.jokers?.count || 0}/${state.jokers?.limit || 5})
- 引擎三位一体诊断：[筹码Chips: ${hasChips ? '✅具备' : '❌缺失'}] | [加法倍率+Mult: ${hasFlatMult ? '✅具备' : '❌缺失'}] | [乘法倍率xMult: ${hasXMult ? '✅具备' : '❌缺失'}]
  -> 引擎当前核心缺口：${missingPieceDesc}
- 已升级牌型: ${upgradedHands.length > 0 ? upgradedHands.join(', ') : '暂无升级，均为基础等级'}
${memoryPromptPart}
请依据《小丑牌高分秘诀：先搭好引擎，再追求爆分》及【历史反思记忆】，为战术执行系统 (System 1 Jev) 制定宏观战略指导简报：
1. 锁定单一主打牌型 (primaryHandType)：
   - ⚠️【前两底注 (Ante 1~2) 铁律】：在尚未拥有强力点数小丑和星球等级前，【绝对禁止锁定高牌 High Card 或对子 Pair】！因为基础分极低（单手仅20~60分），盲目打对子无法逾越 300~600 分必死无疑！前两底注必须锁定高基础点数的【同花 Flush】、【葫芦 Full House】、【顺子 Straight】或【三条 Three of a Kind】！
   - 只有在中后期拥有+筹码/+Mult小丑、冥王星/水星高等级或大量钢铁牌留手时，才允许转型高牌/对子！
2. 引擎补缺与小丑布局：针对三位一体缺口指示选购重点，并要求从左到右严格排序【经济/功能】->【+筹码】->【+Mult】->【xMult最右】
3. 理财与盲注纪律：贯彻前期活下来、攒到 $25 满利息的滚雪球法则；提醒【谨慎跳过盲注，绝大多数情况选 select 进战拿奖金和看商店】
4. BOSS 应对与关卡专注：${isBossBlindActive ? '针对当前 BOSS 特性给出避坑手段' : '当前非BOSS战，提醒 Jev 全力打高基础大牌斩杀过关拿钱，切勿保留弃牌或出弱牌！'}

请以严格的 JSON 格式输出：
{
  "primaryHandType": "Flush",
  "targetHandTypes": ["Flush", "Full House"],
  "recommendedPlayStyle": "集中打出高基础点数牌型确保通关，争取少出牌拿剩余手数奖金",
  "economyGoal": "尽量保持金币在 $25 以上吃满 $5 利息",
  "engineStatus": {
    "hasChips": ${hasChips},
    "hasFlatMult": ${hasFlatMult},
    "hasXMult": ${hasXMult},
    "missingPiece": "${missingPieceDesc}"
  },
  "jokerNeeds": ["需要乘法倍率xMult小丑放在最右侧", "补齐筹码小丑"],
  "bossAlert": "${isBossBlindActive ? '针对当前BOSS词条的破解策略' : '当前为普通盲注，无Boss限制，全力打大牌过关'}",
  "blindActionAdvice": "select",
  "advice": "依据高分秘诀引擎论的核心行动指令一句话"
}`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `你是一名精通《小丑牌》(Balatro) 的顶级战略大师（System 2 宏观战略架构师）。
你深谙小丑牌的全部计分机制、三位一体引擎模型（筹码 × 加法倍率 × 乘法倍率）、单牌型专注论、小丑排序铁律与利息法则，并能够吸取历史战败教训不断进化：

${BALATRO_RULEBOOK}

你只输出严格符合要求的 JSON 格式战略指南。`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        let primaryHand = parsed.primaryHandType || fallbackDirective.primaryHandType;
        // Ante 1-2 safety check: Force high base hand if model hallucinated Pair/High Card without engine
        if ((state.ante_num || 1) <= 2 && (primaryHand === 'Pair' || primaryHand === 'High Card') && !hasChips && !hasFlatMult) {
          primaryHand = 'Flush';
        }

        return {
          primaryHandType: primaryHand,
          targetHandTypes: parsed.targetHandTypes || fallbackDirective.targetHandTypes,
          recommendedPlayStyle: parsed.recommendedPlayStyle || fallbackDirective.recommendedPlayStyle,
          economyGoal: parsed.economyGoal || fallbackDirective.economyGoal,
          engineStatus: parsed.engineStatus || fallbackDirective.engineStatus,
          jokerNeeds: parsed.jokerNeeds || fallbackDirective.jokerNeeds,
          bossAlert: parsed.bossAlert || fallbackDirective.bossAlert,
          blindActionAdvice: parsed.blindActionAdvice || 'select',
          advice: parsed.advice || fallbackDirective.advice,
        };
      }
    } catch (err: any) {
      console.warn(pc.yellow(`[DeepSeek System 2] API 战略推演回退至启发式: ${err.message}`));
    }

    return fallbackDirective;
  }

  /**
   * Post-mortem reflection to extract lessons learned from a defeat
   */
  async reflectOnRun(
    state: GameState,
    lastStrategy: StrategicDirective | null,
    targetScore: number,
    finalScore: number
  ): Promise<RunReflection> {
    const jokers = state.jokers?.cards?.map(j => j.label || j.key) || [];
    const boss = state.blinds?.boss;
    const ante = state.ante_num || 1;
    const money = state.money || 0;

    // Intelligent heuristic baseline
    let defaultRootCause = '基础点数与倍率数值不足以支撑当前关卡目标分';
    let defaultLesson = '中前期必须尽早配置核心加成小丑，并保留金币吃足利息';
    let defaultBossCounter = boss?.effect ? `针对${boss.name}: 避开不利限制，针对性留牌` : undefined;

    if (money < 5) {
      defaultRootCause = '金币过度消耗跌破 $5，丧失了利息滚雪球的能力，导致中后期无钱购入强力小丑';
      defaultLesson = '【严守利息门槛】前两底注除非有致死危险，否则必须保证手头结余在 $5 的整数倍！';
    } else if (jokers.length < 3 && ante >= 2) {
      defaultRootCause = '小丑牌数量严重不足，仅靠手牌基础分无法逾越 800+ 筹码大关';
      defaultLesson = '【填满小丑槽】前两底注在商店中只要有可负担的数值小丑，应果断购买填满 5 个槽位！';
    }

    if (!this.hasKey || !this.client) {
      return {
        rootCause: defaultRootCause,
        lesson: defaultLesson,
        bossCounter: defaultBossCounter,
      };
    }

    try {
      const prompt = `这是一场刚刚失败的小丑牌 (Game Over) 对局黑匣子数据：
- 阵亡阶段：第 ${ante} 底注，第 ${state.round_num} 回合
- 目标筹码：${targetScore} 分，实际累计仅得：${finalScore} 分（差额: ${Math.max(0, targetScore - finalScore)}）
- 阵亡时剩余资金：$${money}
- 阵亡时拥有小丑 (${jokers.length}/5)：${jokers.join(', ') || '无'}
- BOSS 盲注信息：${boss?.name || '普通盲注'} (效果: ${boss?.effect || '无'})
- 上一轮战略指导：${lastStrategy?.advice || '无'}

请作为小丑牌顶级复盘大师，一针见血地诊断死因并提炼 1 条极具指导意义的教训：
请以严格的 JSON 格式输出：
{
  "rootCause": "一句话分析阵亡的核心病根（如经济断流/构筑缺乏xMult/违背BOSS机制等）",
  "lesson": "【行动硬指令】提炼1条下局必须严格执行的避坑纪律（30字以内）",
  "bossCounter": "如果是BOSS战阵亡，提供具体破局策略；非BOSS战则填null"
}`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `你是一名深谙小丑牌全部机制的复盘大师。你精通失败诊断、数值模型归因与长线迭代进化。\n${BALATRO_RULEBOOK}\n只输出 JSON。`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          rootCause: parsed.rootCause || defaultRootCause,
          lesson: parsed.lesson || defaultLesson,
          bossCounter: parsed.bossCounter || defaultBossCounter,
        };
      }
    } catch (e: any) {
      console.warn(pc.yellow(`[DeepSeek Reflection] 复盘分析降级: ${e.message}`));
    }

    return {
      rootCause: defaultRootCause,
      lesson: defaultLesson,
      bossCounter: defaultBossCounter,
    };
  }

  /**
   * Rule-based strategic engine fallback
   */
  private generateHeuristicStrategy(state: GameState): StrategicDirective {
    const jokersCount = state.jokers?.count || 0;
    const jokersLimit = state.jokers?.limit || 5;
    const money = state.money || 0;
    const ante = state.ante_num || 1;
    const boss = state.blinds?.boss;

    let targetHands = ['Flush', 'Full House', 'Three of a Kind'];
    let style = '前期稳妥打出高基础点数牌型（同花/葫芦）一击过关';
    let economy = money >= 25 ? '已达到最大利息($25)，利息盈余可自由购买或刷新' : '积极通关积攒奖金，尽量存到 $25 吃满每回合 $5 利息';
    let jokerNeeds: string[] = [];

    if (jokersCount === 0) {
      jokerNeeds.push('极度渴望第一张小丑牌 (+Mult或+筹码小丑) 填补基础战力');
      style = '尚未拥有小丑牌，全力追求同花(Flush)或葫芦(Full House)的大牌基础分';
    } else if (jokersCount < jokersLimit) {
      if (ante <= 2) {
        jokerNeeds.push('补充平稳过渡的前期点数小丑牌 (+筹码或+Mult)');
      } else {
        jokerNeeds.push('寻找乘法倍率(xMult)小丑放在最右端，以及经济类小丑');
      }
    } else {
      jokerNeeds.push('小丑槽已满，检查摆放顺序(左+筹码/+Mult -> 右xMult)，仅考虑用稀有xMult替换弱势小丑');
    }

    let bossAlert = boss?.effect ? `小心 BOSS 词条: ${boss.name} (${boss.effect})` : '当前非Boss回合，注意保持状态';

    const jokerCards = state.jokers?.cards || [];
    const hasChips = jokerCards.some(j => (j.value?.effect || '').includes('筹码') || (j.key || '').includes('clever') || (j.key || '').includes('ice_cream'));
    const hasFlatMult = jokerCards.some(j => (j.value?.effect || '').includes('+') || (j.key || '').includes('gros') || (j.key || '').includes('mystic'));
    const hasXMult = jokerCards.some(j => (j.value?.effect || '').includes('X') || (j.value?.effect || '').includes('x') || (j.key || '').includes('cavendish'));

    return {
      primaryHandType: 'Flush',
      targetHandTypes: targetHands,
      recommendedPlayStyle: style,
      economyGoal: economy,
      engineStatus: {
        hasChips,
        hasFlatMult,
        hasXMult,
        missingPiece: !hasFlatMult ? '缺+Mult' : (!hasChips ? '缺+Chips' : (!hasXMult ? '缺xMult' : '完善')),
      },
      jokerNeeds,
      bossAlert,
      blindActionAdvice: 'select',
      advice: `【DeepSeek 战略导师】当前第 ${ante} 底注，先搭好基础引擎（筹码×加法倍率），尽早存满 $25 利息，后期寻求乘法倍率爆发！`,
    };
  }
}

import fs from 'fs';
import path from 'path';
import pc from 'picocolors';

export interface RunHistoryItem {
  runId: number;
  timestamp: string;
  reachedAnte: number;
  reachedRound: number;
  finalMoney: number;
  finalScore: number;
  targetScore: number;
  jokers: string[];
  bossName?: string;
  rootCause: string;
  lesson: string;
}

export interface RunReflection {
  rootCause: string;
  lesson: string;
  bossCounter?: string;
}

export interface AgentMemory {
  totalRuns: number;
  bestAnte: number;
  bestRound: number;
  bestScore: number;
  topLessons: string[];
  bossKnowledge: Record<string, string>;
  history: RunHistoryItem[];
}

export class MemoryManager {
  private filePath: string;
  private memory: AgentMemory;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'memory.json');
    this.memory = this.loadMemory();
  }

  /**
   * Load existing memory from JSON or initialize with foundational pro tips
   */
  loadMemory(): AgentMemory {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e: any) {
      console.warn(pc.yellow(`[Memory] 读取历史经验记忆异常，重新初始化: ${e.message}`));
    }

    return {
      totalRuns: 0,
      bestAnte: 1,
      bestRound: 1,
      bestScore: 0,
      topLessons: [
        '【利息铁律】金币是滚雪球基石，非生死存亡绝不可将存款花至 $5 以下，尽早存到 $25 吃满每回合 $5 利息！',
        '【小丑构筑】前两底注先找 +Chips 或 +Mult 小丑保命；第 2 底注以后必须在商店寻找 xMult 乘倍小丑并置于最右端！',
        '【洗牌纪律】手握稳定两对或三条时，绝不要为了博虚无缥缈的牌型把高点数对子弃掉！',
      ],
      bossKnowledge: {
        'The Window': '所有方片牌失效：必须在战前用弃牌滤除方片，改打红桃/黑桃/梅花同花或纯点数葫芦！',
        'The Psychic': '强制必须打满 5 张牌才计分：若手牌只有对子或三条，必须垫入低点数废牌凑齐 5 张打出！',
        'The Needle': '只有 1 次出牌机会：出牌前用光全部弃牌调整手牌，打出最高单次爆发！',
      },
      history: [],
    };
  }

  /**
   * Persist memory to file
   */
  saveMemory(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2), 'utf-8');
    } catch (e: any) {
      console.error(pc.red(`[Memory] 保存经验记忆失败: ${e.message}`));
    }
  }

  /**
   * Record a post-mortem reflection and update learning parameters
   */
  recordRun(
    reflection: RunReflection,
    ante: number,
    round: number,
    money: number,
    score: number,
    targetScore: number,
    jokers: string[],
    bossName?: string
  ): void {
    this.memory.totalRuns += 1;

    if (ante > this.memory.bestAnte || (ante === this.memory.bestAnte && round > this.memory.bestRound)) {
      this.memory.bestAnte = ante;
      this.memory.bestRound = round;
    }
    if (score > this.memory.bestScore) {
      this.memory.bestScore = score;
    }

    const item: RunHistoryItem = {
      runId: this.memory.totalRuns,
      timestamp: new Date().toISOString(),
      reachedAnte: ante,
      reachedRound: round,
      finalMoney: money,
      finalScore: score,
      targetScore,
      jokers,
      bossName,
      rootCause: reflection.rootCause,
      lesson: reflection.lesson,
    };

    this.memory.history.push(item);
    // Keep last 30 runs in history
    if (this.memory.history.length > 30) {
      this.memory.history.shift();
    }

    // Add unique actionable lesson to topLessons
    if (reflection.lesson && !this.memory.topLessons.includes(reflection.lesson)) {
      this.memory.topLessons.unshift(reflection.lesson);
      // Keep top 6 actionable lessons
      if (this.memory.topLessons.length > 6) {
        this.memory.topLessons.pop();
      }
    }

    // Record boss counter if provided
    if (bossName && reflection.bossCounter) {
      this.memory.bossKnowledge[bossName] = reflection.bossCounter;
    }

    this.saveMemory();
  }

  /**
   * Get formatted context string for prompt injection
   */
  getStrategicContext(currentBoss?: string): string {
    const lessonsStr = this.memory.topLessons.map((l, i) => `  ${i + 1}. ${l}`).join('\n');
    let bossTip = '';
    if (currentBoss && this.memory.bossKnowledge[currentBoss]) {
      bossTip = `\n【当前 BOSS 历史对阵破解备忘】: ${currentBoss} -> ${this.memory.bossKnowledge[currentBoss]}`;
    }

    return `【双脑 AI 历代对局反思记忆库 (已迭代 ${this.memory.totalRuns} 局 | 最高纪录: 底注 ${this.memory.bestAnte} 第 ${this.memory.bestRound} 回合)】:
历史核心避坑与战术教训：
${lessonsStr}${bossTip}`;
  }

  getStats(): { totalRuns: number; bestAnte: number; bestRound: number; bestScore: number; lessonsCount: number } {
    return {
      totalRuns: this.memory.totalRuns,
      bestAnte: this.memory.bestAnte,
      bestRound: this.memory.bestRound,
      bestScore: this.memory.bestScore,
      lessonsCount: this.memory.topLessons.length,
    };
  }
}

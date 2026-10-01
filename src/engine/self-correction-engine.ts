import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { Card, GameState } from '../types.js';

export interface PendingPlay {
  handType: string;
  cardsSummary: string;
  cardIndices: number[];
  rawTheoreticalScore: number;
  calibratedScore: number;
  estimatedChips: number;
  estimatedMult: number;
  chipsBefore: number;
  handsLeftBefore: number;
  jokersSnapshot: string[];
  timestamp: number;
}

export interface PlayCalibrationRecord {
  handType: string;
  estimatedScore: number;
  actualScore: number;
  ratio: number;
  delta: number;
  jokers: string[];
  timestamp: string;
}

export interface CalibrationData {
  totalCalibrations: number;
  globalSynergyFactor: number;
  handTypeFactors: Record<string, number>;
  recentRecords: PlayCalibrationRecord[];
  anomalies: string[];
}

export class SelfCorrectionEngine {
  private filePath: string;
  private data: CalibrationData;
  private pendingPlay: PendingPlay | null = null;
  private runCalibrationHistory: PlayCalibrationRecord[] = [];

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'calibration.json');
    this.data = this.loadData();
  }

  private loadData(): CalibrationData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const handTypeFactors: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed.handTypeFactors || {})) {
          // Reset any degraded factors (< 1.0) back to clean 1.0 baseline
          handTypeFactors[k] = typeof v === 'number' && v >= 1.0 ? v : 1.0;
        }
        return {
          totalCalibrations: parsed.totalCalibrations || 0,
          globalSynergyFactor: typeof parsed.globalSynergyFactor === 'number' && parsed.globalSynergyFactor >= 1.0 ? parsed.globalSynergyFactor : 1.0,
          handTypeFactors,
          recentRecords: Array.isArray(parsed.recentRecords) ? parsed.recentRecords : [],
          anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
        };
      }
    } catch (e: unknown) {
      console.warn(pc.yellow(`[SelfCorrection] 加载自纠记忆文件异常: ${e instanceof Error ? e.message : String(e)}，初始化默认配置`));
    }

    return {
      totalCalibrations: 0,
      globalSynergyFactor: 1.0,
      handTypeFactors: {
        'Flush': 1.0,
        'Full House': 1.0,
        'Straight': 1.0,
        'Three of a Kind': 1.0,
        'Two Pair': 1.0,
        'Pair': 1.0,
        'High Card': 1.0,
      },
      recentRecords: [],
      anomalies: [],
    };
  }


  saveData(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e: unknown) {
      console.warn(pc.yellow(`[SelfCorrection] 写入自纠记忆文件异常: ${e instanceof Error ? e.message : String(e)}`));
    }

  }

  /**
   * Get dynamic calibration multiplier for a specific hand type
   */
  getCalibrationFactor(handType: string): number {
    const handFactor = this.data.handTypeFactors[handType] !== undefined
      ? this.data.handTypeFactors[handType]
      : 1.0;

    // If this specific hand was flagged as debuffed/anomalous (<= 0.2), strictly enforce safety dampening!
    if (handFactor <= 0.2) {
      return handFactor;
    }

    const globalFactor = this.data.globalSynergyFactor || 1.0;
    // Blend hand-specific factor (70%) with global joker synergy factor (30%)
    const blended = handFactor * 0.7 + globalFactor * 0.3;
    // Mathematical base score is the strict minimum: non-debuffed hands can never score below 1.0x!
    return Math.max(1.0, Math.min(20.0, parseFloat(blended.toFixed(2))));
  }


  /**
   * Calculate calibrated score given raw theoretical estimation
   */
  applyCalibration(rawScore: number, handType: string): number {
    const factor = this.getCalibrationFactor(handType);
    return Math.round(rawScore * factor);
  }

  /**
   * Record a play right before calling the Balatro driver
   */
  recordPendingPlay(
    handType: string,
    cardsSummary: string,
    cardIndices: number[],
    rawTheoreticalScore: number,
    calibratedScore: number,
    estimatedChips: number,
    estimatedMult: number,
    state: GameState
  ): void {
    const jokersSnapshot = state.jokers?.cards?.map(j => j.label || j.key || 'Joker') || [];
    this.pendingPlay = {
      handType,
      cardsSummary,
      cardIndices,
      rawTheoreticalScore,
      calibratedScore,
      estimatedChips,
      estimatedMult,
      chipsBefore: state.round?.chips || 0,
      handsLeftBefore: state.round?.hands_left || 1,
      jokersSnapshot,
      timestamp: Date.now(),
    };
  }

  /**
   * Check whether a pending play was executed and compare estimated vs actual score
   */
  checkAndCalibrate(currentState: GameState, currentBoss?: { name: string; effect: string }): boolean {
    if (!this.pendingPlay) return false;

    const currentChips = currentState.round?.chips || 0;
    const actualGained = currentChips - this.pendingPlay.chipsBefore;

    // In Balatro, score updates as soon as cards are scored in HAND_PLAYED or DRAW_TO_HAND or SELECTING_HAND
    // If chips haven't changed yet, wait for next tick
    if (actualGained <= 0 && currentState.round?.hands_left === this.pendingPlay.handsLeftBefore) {
      return false;
    }

    const rawScore = this.pendingPlay.rawTheoreticalScore;
    const calibrated = this.pendingPlay.calibratedScore;
    const handType = this.pendingPlay.handType;
    const jokers = this.pendingPlay.jokersSnapshot;

    // ─────────────────────────────────────────────────────────────
    // 1. Critical Anomaly: Score is 0 (Debuffed by Boss or rule violation)
    // ─────────────────────────────────────────────────────────────
    if (actualGained === 0 && rawScore > 0) {
      const anomalyMsg = `[0分异常] 打出【${handType}】预估 ${calibrated} 分(理论: ${rawScore})，实得 0 分！BOSS: ${currentBoss?.name || '未知'}`;
      console.log(pc.bold(pc.red(`\n🚨 [自纠异常诊断] 本手出牌【${handType}】预估 ${calibrated} 分，实际得分竟然为 0！`)));
      if (currentBoss) {
        console.log(pc.yellow(`🔍 [根因诊断] 检测到 BOSS【${currentBoss.name}】(${currentBoss.effect}) 词条削弱生效，该牌型被判定为无效或被克制！`));
      }
      console.log(pc.dim(`🛡️ [自纠防御调整] 自动临时下调【${handType}】在当前关卡下的有效系数，防止二次踩坑！\n`));

      this.data.handTypeFactors[handType] = 0.1;
      this.data.anomalies.push(anomalyMsg);
      if (this.data.anomalies.length > 20) this.data.anomalies.shift();

      this.pendingPlay = null;
      this.saveData();
      return true;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Normal Calibration: Compare Actual vs Estimated
    // ─────────────────────────────────────────────────────────────
    // theoreticalRatio: Actual gained vs raw theoretical base model (used to train dynamic synergy multiplier)
    const theoreticalRatio = actualGained / Math.max(1, rawScore);
    // accuracyRatio: Actual gained vs calibrated prediction (used to measure prediction accuracy)
    const accuracyRatio = actualGained / Math.max(1, calibrated);
    const delta = actualGained - calibrated;
    const deltaPercent = ((accuracyRatio - 1) * 100).toFixed(1);
    const sign = Number(deltaPercent) >= 0 ? '+' : '';

    const prevFactor = this.data.handTypeFactors[handType] || 1.0;
    // Non-debuffed hands can never degrade below 1.0x mathematical ground truth
    const updatedFactor = Math.min(20.0, Math.max(1.0, parseFloat((prevFactor * 0.4 + theoreticalRatio * 0.6).toFixed(2))));
    this.data.handTypeFactors[handType] = updatedFactor;

    // Update global joker synergy factor (minimum 1.0)
    const prevGlobal = this.data.globalSynergyFactor || 1.0;
    const updatedGlobal = Math.min(20.0, Math.max(1.0, parseFloat((prevGlobal * 0.6 + theoreticalRatio * 0.4).toFixed(2))));
    this.data.globalSynergyFactor = updatedGlobal;

    this.data.totalCalibrations++;

    const record: PlayCalibrationRecord = {
      handType,
      estimatedScore: calibrated,
      actualScore: actualGained,
      ratio: parseFloat(theoreticalRatio.toFixed(2)),
      delta,
      jokers,
      timestamp: new Date().toISOString(),
    };

    this.data.recentRecords.push(record);
    if (this.data.recentRecords.length > 30) this.data.recentRecords.shift();
    this.runCalibrationHistory.push(record);

    console.log(pc.bold(pc.cyan(`\n🎯 [真实得分自纠核验] 打出【${handType}】: 预估 ${calibrated} 分 (基础理论: ${rawScore}) -> 实际进账 ${actualGained} 分 (误差: ${sign}${deltaPercent}%)`)));
    if (Math.abs(accuracyRatio - 1) >= 0.15) {
      const statusIcon = accuracyRatio > 1 ? '🔥' : '⚠️';
      const statusText = accuracyRatio > 1 ? '小丑协同超出预期' : '实际得分低于校准值';
      console.log(pc.bold(pc.yellow(`🔧 [自纠校准自适应] ${statusIcon} ${statusText}！已自动纠偏【${handType}】动态协同系数: ×${prevFactor.toFixed(2)} ➔ ×${updatedFactor.toFixed(2)} (全局系数: ×${updatedGlobal.toFixed(2)})`)));
    } else {
      console.log(pc.green(`✓ [自纠校准自适应] 理论模型与实际得分高度吻合 (吻合度: ${(Math.min(accuracyRatio, 1 / accuracyRatio) * 100).toFixed(0)}%)`));
    }
    console.log('');

    this.pendingPlay = null;
    this.saveData();
    return true;
  }

  /**
   * Summarize calibration lessons for this run (to feed into DeepSeek post-game reflection)
   */
  getRunCalibrationSummary(): string {
    if (this.runCalibrationHistory.length === 0) {
      return '本轮对局未打出计分牌型，暂无自纠样本。';
    }

    const totalPlays = this.runCalibrationHistory.length;
    const totalEstimated = this.runCalibrationHistory.reduce((sum, r) => sum + r.estimatedScore, 0);
    const totalActual = this.runCalibrationHistory.reduce((sum, r) => sum + r.actualScore, 0);
    const overallRatio = (totalActual / Math.max(1, totalEstimated)).toFixed(2);

    const handMap: Record<string, { count: number; totalActual: number; totalEst: number }> = {};
    for (const r of this.runCalibrationHistory) {
      if (!handMap[r.handType]) handMap[r.handType] = { count: 0, totalActual: 0, totalEst: 0 };
      handMap[r.handType].count++;
      handMap[r.handType].totalActual += r.actualScore;
      handMap[r.handType].totalEst += r.estimatedScore;
    }

    const handDetails = Object.entries(handMap)
      .map(([type, stats]) => `${type}(共${stats.count}手, 实际/预估比: ×${(stats.totalActual / Math.max(1, stats.totalEst)).toFixed(2)})`)
      .join('; ');

    return `本轮出牌共计 ${totalPlays} 手，全场总预估: ${totalEstimated} 分，实际总得分: ${totalActual} 分 (综合放大比率: ×${overallRatio})。牌型实测分布: ${handDetails}。`;
  }

  /**
   * Reset run-specific temporary factors when new game starts
   */
  resetRun(): void {
    this.pendingPlay = null;
    this.runCalibrationHistory = [];
    // Reset any zeroed-out factors back to healthy baseline
    for (const [k, v] of Object.entries(this.data.handTypeFactors)) {
      if (v < 0.5) this.data.handTypeFactors[k] = 1.0;
    }
  }
}

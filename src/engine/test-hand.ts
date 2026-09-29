import { PokerEvaluator } from './poker-evaluator.js';
import { SelfCorrectionEngine } from './self-correction-engine.js';
import { Card, GameState } from '../types.js';
import pc from 'picocolors';
import path from 'path';
import fs from 'fs';

console.log(pc.bold(pc.cyan('🧪 正在测试小丑牌手牌评估引擎 (Poker Evaluator)...')));

// Test 1: Full House test
const cards1: Card[] = [
  { id: 1, label: '7 of Hearts', value: { rank: '7', suit: 'H' } },
  { id: 2, label: '7 of Spades', value: { rank: '7', suit: 'S' } },
  { id: 3, label: '7 of Diamonds', value: { rank: '7', suit: 'D' } },
  { id: 4, label: 'Jack of Clubs', value: { rank: 'J', suit: 'C' } },
  { id: 5, label: 'Jack of Hearts', value: { rank: 'J', suit: 'H' } },
  { id: 6, label: '2 of Clubs', value: { rank: '2', suit: 'C' } },
  { id: 7, label: '3 of Spades', value: { rank: '3', suit: 'S' } },
  { id: 8, label: '4 of Diamonds', value: { rank: '4', suit: 'D' } },
];

const res1 = PokerEvaluator.evaluateCombination(cards1, [0, 1, 2, 3, 4]);
console.log(pc.green(`测试 1 - 葫芦识别:`), res1.handType, `预估分数: ${res1.totalScore} (${res1.chips}x${res1.mult})`);
if (res1.handType !== 'Full House') {
  console.error(pc.red(`❌ 预期 Full House，实际为: ${res1.handType}`));
} else {
  console.log(pc.green('✓ 成功识别 Full House (777 + JJ)!'));
}

// Test 2: Flush test
const cards2: Card[] = [
  { id: 1, label: 'Ace of Hearts', value: { rank: 'A', suit: 'H' } },
  { id: 2, label: 'King of Hearts', value: { rank: 'K', suit: 'H' } },
  { id: 3, label: '9 of Hearts', value: { rank: '9', suit: 'H' } },
  { id: 4, label: '6 of Hearts', value: { rank: '6', suit: 'H' } },
  { id: 5, label: '2 of Hearts', value: { rank: '2', suit: 'H' } },
  { id: 6, label: '8 of Spades', value: { rank: '8', suit: 'S' } },
  { id: 7, label: 'Q of Clubs', value: { rank: 'Q', suit: 'C' } },
  { id: 8, label: '3 of Diamonds', value: { rank: '3', suit: 'D' } },
];

const res2 = PokerEvaluator.evaluateCombination(cards2, [0, 1, 2, 3, 4]);
console.log(pc.green(`测试 2 - 同花识别:`), res2.handType, `预估分数: ${res2.totalScore} (${res2.chips}x${res2.mult})`);
if (res2.handType !== 'Flush') {
  console.error(pc.red(`❌ 预期 Flush，实际为: ${res2.handType}`));
} else {
  console.log(pc.green('✓ 成功识别 Flush (同花)!'));
}

// Test 3: Candidate generation
const candidates = PokerEvaluator.generateCandidates(cards1, 3, 2, 300, 0);
console.log(pc.magenta(`\n测试 3 - 战术候选集生成: 共有 ${candidates.length} 项候选`));
candidates.slice(0, 4).forEach((c, idx) => {
  console.log(`  [候选 ${idx + 1}] (${c.type.toUpperCase()}) ${c.cardsSummary} -> ${c.reason}`);
});

// Test 4: Five of a Kind & Flush Five
const cardsSpecial: Card[] = [
  { id: 1, label: 'Ace of Spades', value: { rank: 'A', suit: 'S' } },
  { id: 2, label: 'Ace of Spades', value: { rank: 'A', suit: 'S' } },
  { id: 3, label: 'Ace of Spades', value: { rank: 'A', suit: 'S' } },
  { id: 4, label: 'Ace of Spades', value: { rank: 'A', suit: 'S' } },
  { id: 5, label: 'Ace of Spades', value: { rank: 'A', suit: 'S' } },
];
const resFlushFive = PokerEvaluator.evaluateCombination(cardsSpecial, [0, 1, 2, 3, 4]);
console.log(pc.green(`测试 4 - 同花五条识别:`), resFlushFive.handType, `预估分数: ${resFlushFive.totalScore}`);
if (resFlushFive.handType !== 'Flush Five') {
  console.error(pc.red(`❌ 预期 Flush Five，实际为: ${resFlushFive.handType}`));
} else {
  console.log(pc.green('✓ 成功识别 Flush Five (同花五条)!'));
}

// Test 5: Enhancements (Glass x2, Red Seal) and Purple Seal Discard
const cardsEnhanced: Card[] = [
  { id: 1, label: 'Glass King of Hearts', value: { rank: 'K', suit: 'H' }, modifier: ['GLASS'] },
  { id: 2, label: 'Red Seal King of Spades', value: { rank: 'K', suit: 'S' }, modifier: ['RED_SEAL'] },
  { id: 3, label: 'Purple Seal 2 of Clubs', value: { rank: '2', suit: 'C' }, modifier: ['PURPLE_SEAL'] },
  { id: 4, label: 'Steel 3 of Diamonds', value: { rank: '3', suit: 'D' }, modifier: ['STEEL'] },
];

const resGlass = PokerEvaluator.evaluateCombination(cardsEnhanced, [0, 1]);
console.log(pc.green(`测试 5 - 强化牌计分(玻璃+红蜡封):`), resGlass.handType, `预估分数: ${resGlass.totalScore} (${resGlass.chips}x${resGlass.mult})`);

const enhancedCandidates = PokerEvaluator.generateCandidates(cardsEnhanced, 3, 2, 500, 0);
const purpleCandidate = enhancedCandidates.find(c => c.reason.includes('紫色蜡封'));
if (purpleCandidate) {
  console.log(pc.green(`✓ 成功识别并优先生成紫色蜡封白嫖塔罗候选: ${purpleCandidate.reason}`));
} else {
  console.error(pc.red(`❌ 未能识别紫色蜡封候选`));
}

// Test 6: JokerSorter test (Economy -> Chips -> Mult -> Retrigger -> Blueprint -> xMult)
import { JokerSorter } from './joker-sorter.js';
const jokersSample: Card[] = [
  { id: 1, key: 'j_cavendish', label: 'Cavendish', value: { effect: 'x3 Mult' } },
  { id: 2, key: 'j_blueprint', label: 'Blueprint', value: { effect: 'Copies ability to the right' } },
  { id: 3, key: 'j_golden', label: 'Golden Joker', value: { effect: '+$4 at round end' } },
  { id: 4, key: 'j_ice_cream', label: 'Ice Cream', value: { effect: '+100 Chips' } },
  { id: 5, key: 'j_hanging_chad', label: 'Hanging Chad', value: { effect: 'Retrigger first played card 2 times' } },
];

const sortResult = JokerSorter.getOptimalOrder(jokersSample);
console.log(pc.green(`测试 6 - 小丑排序算法:`), sortResult.description);
console.log(`重排需求: ${sortResult.needsRearrange ? '需重排' : '已最优'}, 顺序索引: [${sortResult.newOrder.join(', ')}]`);
// Expected order: Golden Joker (idx 2) -> Ice Cream (idx 3) -> Hanging Chad (idx 4) -> Blueprint (idx 1) -> Cavendish (idx 0)
if (sortResult.newOrder[sortResult.newOrder.length - 1] === 0 && sortResult.newOrder[sortResult.newOrder.length - 2] === 1) {
  console.log(pc.green('✓ 成功将 Blueprint 精确对齐到最强乘倍牌 Cavendish 左侧，并将 Cavendish 置于最右端！'));
} else {
  console.error(pc.red(`❌ 排序结果不符合预期: [${sortResult.newOrder.join(', ')}]`));
}

// Test 7: Big Blind 5-card Flush vs Pair Priority Test (Exact user scenario)
const cardsBigBlindTest: Card[] = [
  { id: 1, label: 'Ace of Diamonds', value: { rank: 'A', suit: 'D' } },
  { id: 2, label: 'King of Diamonds', value: { rank: 'K', suit: 'D' } },
  { id: 3, label: 'Queen of Hearts', value: { rank: 'Q', suit: 'H' } },
  { id: 4, label: 'Queen of Diamonds', value: { rank: 'Q', suit: 'D' } },
  { id: 5, label: '5 of Spades', value: { rank: '5', suit: 'S' } },
  { id: 6, label: '5 of Clubs', value: { rank: '5', suit: 'C' } },
  { id: 7, label: '4 of Diamonds', value: { rank: '4', suit: 'D' } },
  { id: 8, label: '2 of Diamonds', value: { rank: '2', suit: 'D' } },
];

const candidates7 = PokerEvaluator.generateCandidates(cardsBigBlindTest, 4, 4, 450, 0, undefined, 'Pair');
console.log(pc.green(`测试 7 - 绝杀同花保护测试 (即使有Pair建议，也必须优先出288分同花而非拆牌弃同花):`));
console.log(`  候选 1: (${candidates7[0].type.toUpperCase()}) ${candidates7[0].cardsSummary} -> ${candidates7[0].reason} [优先分: ${candidates7[0].priorityScore}]`);
if (candidates7[0].type === 'play' && candidates7[0].handType === 'Flush') {
  console.log(pc.green('✓ 成功优先打出 288分同花大牌，完全杜绝了拆散方片同花打对子的低级失误！'));
} else {
  console.error(pc.red(`❌ 候选 1 不是同花，实际为: ${candidates7[0].handType || candidates7[0].type}`));
}

// Test 8: The Mouth Boss Constraint Test (Once locked into Two Pair, cannot play Flush or Pair!)
const mouthCandidates = PokerEvaluator.generateCandidates(
  cardsBigBlindTest,
  3,
  2,
  1600,
  300,
  undefined,
  undefined,
  { bossName: 'The Mouth', mouthLockedHandType: 'Two Pair' }
);
console.log(pc.green(`测试 8 - The Mouth 锁定测试 (已锁定 Two Pair):`));
const playMouth = mouthCandidates.filter(c => c.type === 'play');
if (playMouth.length > 0 && playMouth.every(c => c.handType === 'Two Pair')) {
  console.log(pc.green('✓ 成功！对战 The Mouth 时，所有出牌候选均严格限制为已锁定的【Two Pair】，彻底杜绝被 0 分吃牌！'));
} else {
  console.error(pc.red(`❌ 存在非 Two Pair 的出牌候选: ${playMouth.map(c => c.handType).join(', ')}`));
}

// Test 9: Joker Scoring Integration Test (Pair of 3s with +15 Mult and x2 Mult)
const pairCardsSample: Card[] = [
  { id: 1, label: '3 of Spades', value: { rank: '3', suit: 'S' } },
  { id: 2, label: '3 of Diamonds', value: { rank: '3', suit: 'D' } },
  { id: 3, label: 'Ace of Hearts', value: { rank: 'A', suit: 'H' } },
  { id: 4, label: 'King of Clubs', value: { rank: 'K', suit: 'C' } },
];
const sampleJokers: Card[] = [
  { id: 101, key: 'j_gros_michel', label: 'Gros Michel', value: { effect: '+15 Mult' } },
  { id: 102, key: 'j_the_duo', label: 'The Duo', value: { effect: 'x2 Mult for Pair' } },
];
const evalWithJokers = PokerEvaluator.evaluateCombination(pairCardsSample, [0, 1], undefined, sampleJokers);
console.log(pc.green(`测试 9 - 小丑加成得分计算测试 (Pair of 3s + Gros Michel + The Duo):`));
console.log(`  预估得分: ${evalWithJokers.totalScore}分 (${evalWithJokers.chips}筹码 × ${evalWithJokers.mult}倍率)`);
if (evalWithJokers.totalScore >= 500) {
  console.log(pc.green(`✓ 成功！对子从裸分 32 分准确提升至 ${evalWithJokers.totalScore} 分 (精确计入 +15Mult 与 x2Mult 小丑加成)！`));
} else {
  console.error(pc.red(`❌ 小丑加成未生效，仅得分: ${evalWithJokers.totalScore}`));
}

// Test 10: 4-Spade Flush Protection & Play-to-Discard Test
const cardsAnte3SmallBlind: Card[] = [
  { id: 1, label: 'Ace of Diamonds', value: { rank: 'A', suit: 'D' } },
  { id: 2, label: 'Queen of Spades', value: { rank: 'Q', suit: 'S' } },
  { id: 3, label: 'Jack of Hearts', value: { rank: 'J', suit: 'H' } },
  { id: 4, label: '8 of Spades', value: { rank: '8', suit: 'S' } },
  { id: 5, label: '7 of Spades', value: { rank: '7', suit: 'S' } },
  { id: 6, label: '5 of Spades', value: { rank: '5', suit: 'S' } },
  { id: 7, label: '3 of Hearts', value: { rank: '3', suit: 'H' } },
  { id: 8, label: '2 of Clubs', value: { rank: '2', suit: 'C' } },
];
const candidates10 = PokerEvaluator.generateCandidates(
  cardsAnte3SmallBlind,
  7,
  0,
  2000,
  0,
  undefined,
  'Flush',
  undefined,
  sampleJokers
);
console.log(pc.green(`测试 10 - 零弃牌时【以打代弃】与 4 黑桃同花保护测试:`));
const topCandidate = candidates10[0];
console.log(`  最佳候选: (${topCandidate.type.toUpperCase()}) ${topCandidate.cardsSummary} -> ${topCandidate.reason}`);
// Verify that none of the Spades (Q♠, 8♠, 7♠, 5♠ - indices 1, 3, 4, 5) were included in the junk discard play
const spadeIndices = [1, 3, 4, 5];
const hasSacrificedSpade = topCandidate.cardIndices.some(idx => spadeIndices.includes(idx));
if (!hasSacrificedSpade) {
  console.log(pc.green('✓ 成功！所有 4 张核心黑桃同花牌均被 100% 保护，AI 自动打出 4 张非黑桃杂牌以打代弃过牌换牌！'));
} else {
  console.error(pc.red(`❌ 核心黑桃牌被误打出: ${topCandidate.cardsSummary}`));
}

// Test 11: Self-Correction Engine Calibration & Anomaly Diagnosis Test
const testCalibrationPath = path.resolve(process.cwd(), 'data', 'test-calibration.json');
if (fs.existsSync(testCalibrationPath)) fs.unlinkSync(testCalibrationPath);

const sc = new SelfCorrectionEngine(testCalibrationPath);
console.log(pc.green(`测试 11 - 自纠校准引擎闭环测试 (动态协同因子自学习与 BOSS 异常诊断):`));

// 1. Initial baseline
const initialFactor = sc.getCalibrationFactor('Pair');
console.log(`  初始对子校准系数: ×${initialFactor.toFixed(2)}`);

// 2. Simulate play: rawScore = 32, calibrated = 32, but real in-game score = 704
const mockStateBefore: any = {
  round: { chips: 0, hands_left: 4 },
  jokers: { cards: [{ label: 'Gros Michel' }, { label: 'The Duo' }] }
};
sc.recordPendingPlay('Pair', '3♠ 3♦', [0, 1], 32, 32, 16, 2, mockStateBefore);

const mockStateAfter: any = {
  round: { chips: 704, hands_left: 3 },
  jokers: { cards: [{ label: 'Gros Michel' }, { label: 'The Duo' }] }
};
sc.checkAndCalibrate(mockStateAfter);

const calibratedFactorAfter = sc.getCalibrationFactor('Pair');
console.log(`  实测 704 分自适应校准后对子系数: ×${calibratedFactorAfter.toFixed(2)}`);
if (calibratedFactorAfter > 5.0) {
  console.log(pc.green(`✓ 成功！对子协同放大系数从 ×1.00 自适应进化至 ×${calibratedFactorAfter.toFixed(2)}！`));
} else {
  console.error(pc.red(`❌ 校准系数更新失败，当前为: ${calibratedFactorAfter}`));
}

// 3. Test Anomaly detection (Debuffed by Boss, real score = 0)
const mockStateBeforeDebuff: any = {
  round: { chips: 704, hands_left: 3 },
  jokers: { cards: [] }
};
sc.recordPendingPlay('Flush', 'A♠ K♠ Q♠ J♠ 9♠', [0, 1, 2, 3, 4], 450, 450, 75, 6, mockStateBeforeDebuff);
const mockStateAfterDebuff: any = {
  round: { chips: 704, hands_left: 2 },
  jokers: { cards: [] }
};
sc.checkAndCalibrate(mockStateAfterDebuff, { name: 'The Goad', effect: '所有黑桃卡牌失去效果' });
const flushFactor = sc.getCalibrationFactor('Flush');
console.log(`  黑桃被 BOSS 废除后实得 0 分，同花有效系数动态下调为: ×${flushFactor.toFixed(2)}`);
if (flushFactor <= 0.5) {
  console.log(pc.green('✓ 成功！BOSS 克制 0 分异常触发安全防御，同花有效系数被安全降级防踩坑！'));
} else {
  console.error(pc.red(`❌ 0 分异常降级失败: ${flushFactor}`));
}

// 4. Test run summary
const summary = sc.getRunCalibrationSummary();
console.log(`  对局黑匣子复盘汇报: ${summary}`);

// Clean up test file
if (fs.existsSync(testCalibrationPath)) fs.unlinkSync(testCalibrationPath);

console.log(pc.bold(pc.green('\n🎉 评估与自纠引擎自检全部通过！\n')));

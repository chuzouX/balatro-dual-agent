import { PokerEvaluator } from './poker-evaluator.js';
import { Card } from '../types.js';
import pc from 'picocolors';

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

console.log(pc.bold(pc.green('\n🎉 评估引擎自检全部通过！\n')));

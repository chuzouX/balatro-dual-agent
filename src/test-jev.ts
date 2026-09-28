import { JevAgent } from './engine/jev-agent.js';
import { PokerEvaluator } from './engine/poker-evaluator.js';
import { Card, GameState, StrategicDirective } from './types.js';
import pc from 'picocolors';

async function testJev() {
  console.log(pc.bold(pc.cyan('⚡ 正在测试 Jev (System 1) 战术直觉决策引擎...')));

  const jev = new JevAgent();

  const mockCards: Card[] = [
    { id: 1, label: 'Ace of Spades', value: { rank: 'A', suit: 'S' } },
    { id: 2, label: 'King of Spades', value: { rank: 'K', suit: 'S' } },
    { id: 3, label: '10 of Spades', value: { rank: 'T', suit: 'S' } },
    { id: 4, label: '4 of Spades', value: { rank: '4', suit: 'S' } },
    { id: 5, label: '2 of Hearts', value: { rank: '2', suit: 'H' } },
    { id: 6, label: '3 of Diamonds', value: { rank: '3', suit: 'D' } },
    { id: 7, label: '8 of Clubs', value: { rank: '8', suit: 'C' } },
    { id: 8, label: '9 of Clubs', value: { rank: '9', suit: 'C' } },
  ];

  const mockState = {
    state: 'SELECTING_HAND',
    money: 12,
    round_num: 1,
    ante_num: 1,
    round: {
      chips: 50,
      hands_left: 3,
      discards_left: 2,
      hands_played: 1,
      discards_used: 0,
      reroll_cost: 5,
    },
    jokers: {
      count: 0,
      limit: 5,
      cards: [],
    },
  } as unknown as GameState;

  const mockStrategy: StrategicDirective = {
    targetHandTypes: ['Flush'],
    recommendedPlayStyle: '全力做同花',
    economyGoal: '攒钱吃利息',
    jokerNeeds: ['筹码小丑'],
    advice: '目前4张黑桃，果断弃杂色牌冲黑桃同花',
  };

  const candidates = PokerEvaluator.generateCandidates(mockCards, 3, 2, 300, 50);

  console.log(pc.yellow(`战术候选数: ${candidates.length}`));
  candidates.slice(0, 3).forEach((c, i) => {
    console.log(`  [${i}] ${c.type} ${c.cardsSummary} -> ${c.reason}`);
  });

  console.log(pc.cyan('\n正在向 Jev System 1 发起战术直觉裁决...'));
  const decision = await jev.decideHandAction(mockState, candidates, mockStrategy, 300);

  console.log(pc.green('\n✅ Jev 裁决结果:'));
  console.log(pc.bold(`  动作: ${decision.action}`));
  console.log(`  理由: ${decision.reason}`);
  console.log(`  置信度: ${(decision.confidence * 100).toFixed(0)}%`);
  console.log(`  决策来源: ${decision.source}`);
}

testJev().catch(err => {
  console.error(pc.red(`❌ Jev 测试异常: ${err.message}`));
  process.exit(1);
});

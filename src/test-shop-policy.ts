import { JevAgent } from './engine/jev-agent.js';
import { GameState, StrategicDirective } from './types.js';

async function testShopPolicy() {
  console.log('🧪 正在测试商店决策与槽位保护策略 (Shop Policy Tests)...\n');
  const jev = new JevAgent();

  const mockStrategy: StrategicDirective = {
    targetHandTypes: ['Flush'],
    recommendedPlayStyle: '发育',
    economyGoal: '保持利息',
    jokerNeeds: ['xMult'],
    advice: '寻找乘倍小丑',
  };

  // Scenario 1: Jokers 5/5, Shop has normal Jokers only, Money $18
  // Expected: NO reroll, NO buys, Fast-path exit to next_round!
  const state1 = {
    state: 'SHOP',
    money: 18,
    jokers: {
      count: 5,
      limit: 5,
      cards: [
        { key: 'j_clever', label: 'Clever Joker' },
        { key: 'j_mystic_summit', label: 'Mystic Summit' },
        { key: 'j_misprint', label: 'Misprint' },
        { key: 'j_drunkard', label: 'Drunkard' },
        { key: 'j_ice_cream', label: 'Ice Cream', cost: { sell: 2 } },
      ],
    },
    consumables: { count: 0, limit: 2, cards: [] },
    round: { reroll_cost: 5 },
    shop: {
      cards: [
        { key: 'j_jolly', label: 'Jolly Joker', set: 'JOKER', cost: { buy: 3 } },
        { key: 'j_four_fingers_test', label: 'Normal Card', set: 'JOKER', cost: { buy: 4 } },
      ],
    },
  } as unknown as GameState;

  const d1 = await jev.decideShopAction(state1, mockStrategy);
  console.log('场景 1 [小丑5/5, 货架均为普通小丑, $18]:');
  console.log(`   决策: ${d1.action} | 来源: ${d1.source} | 理由: ${d1.reason}`);
  if (d1.action !== 'next_round' || d1.source !== 'tactical_fast_path') {
    throw new Error('场景 1 失败: 应该触发快速离店，而不是刷新或购买！');
  }
  console.log('   ✓ 验证通过: 成功阻止刷新与非法购买，秒触发离店保利息！\n');

  // Scenario 2: Jokers 5/5, Shop has Pluto ($3) and Flash Card ($5), Money $23
  // Expected: Pluto (Planet) is available to buy! Reroll is FORBIDDEN!
  const state2 = {
    state: 'SHOP',
    money: 23,
    jokers: {
      count: 5,
      limit: 5,
      cards: [
        { key: 'j_clever', label: 'Clever Joker' },
        { key: 'j_mystic_summit', label: 'Mystic Summit' },
        { key: 'j_misprint', label: 'Misprint' },
        { key: 'j_drunkard', label: 'Drunkard' },
        { key: 'j_ice_cream', label: 'Ice Cream', cost: { sell: 2 } },
      ],
    },
    consumables: { count: 0, limit: 2, cards: [] },
    round: { reroll_cost: 5 },
    shop: {
      cards: [
        { key: 'j_flash', label: 'Flash Card', set: 'JOKER', cost: { buy: 5 } },
        { key: 'c_pluto', label: 'Pluto', set: 'PLANET', cost: { buy: 3 } },
      ],
    },
  } as unknown as GameState;

  const d2 = await jev.decideShopAction(state2, mockStrategy);
  console.log('场景 2 [小丑5/5, 货架有冥王星Pluto $3, $23]:');
  console.log(`   决策: ${d2.action} | 参数: ${JSON.stringify(d2.params)} | 理由: ${d2.reason}`);
  if (d2.action === 'reroll') {
    throw new Error('场景 2 失败: 绝对不能选择刷新！');
  }
  console.log('   ✓ 验证通过: 成功封禁刷新，优先购买星球或离店！\n');

  // Scenario 3: Jokers 5/5, Shop has game-changing Four Fingers ($7), Player has decaying Ice Cream
  // Expected: Replace Joker (sell Ice Cream, buy Four Fingers)
  const state3 = {
    state: 'SHOP',
    money: 10,
    jokers: {
      count: 5,
      limit: 5,
      cards: [
        { key: 'j_clever', label: 'Clever Joker' },
        { key: 'j_mystic_summit', label: 'Mystic Summit' },
        { key: 'j_misprint', label: 'Misprint' },
        { key: 'j_drunkard', label: 'Drunkard', cost: { sell: 2 } },
        { key: 'j_ice_cream', label: 'Ice Cream', cost: { sell: 2 } },
      ],
    },
    consumables: { count: 0, limit: 2, cards: [] },
    round: { reroll_cost: 5 },
    shop: {
      cards: [
        { key: 'j_cavendish', label: 'Cavendish', set: 'JOKER', cost: { buy: 5 }, value: { effect: 'X3 Mult' } },
      ],
    },
  } as unknown as GameState;

  const d3 = await jev.decideShopAction(state3, mockStrategy);
  console.log('场景 3 [小丑5/5, 货架出现神级卡 Four Fingers, 存在衰减冰淇淋]:');
  console.log(`   决策: ${d3.action} | 参数: ${JSON.stringify(d3.params)} | 理由: ${d3.reason}`);
  if (d3.action !== 'replace_joker') {
    throw new Error('场景 3 失败: 应该触发置换弱势小丑购买核心卡！');
  }
  console.log('   ✓ 验证通过: 成功触发智能置换（卖衰减冰淇淋腾位买神卡）！\n');

  console.log('🎉 所有商店决策与防盲刷策略单测全部通过！');
}

testShopPolicy().catch(err => {
  console.error('❌ 测试异常:', err);
  process.exit(1);
});

import { BalatroClient } from './driver/balatro-client.js';
import pc from 'picocolors';

async function main() {
  console.log(pc.bold(pc.cyan('🔍 正在测试 BalatroBot API 通信状态...')));

  const client = new BalatroClient();
  const healthy = await client.health();

  if (!healthy) {
    console.error(pc.red('❌ Balatro 未响应！请确保游戏与 BalatroBot 正在运行 (http://127.0.0.1:12346)。'));
    process.exit(1);
  }

  console.log(pc.green('✅ BalatroBot 连接正常！'));

  const state = await client.getGameState();
  console.log(pc.yellow(`🎮 当前游戏状态: ${state.state}`));
  console.log(pc.cyan(`💰 金币: $${state.money}`));
  console.log(pc.magenta(`🃏 底注 (Ante): ${state.ante_num} | 回合: ${state.round_num}`));
  console.log(pc.dim(`🤡 小丑牌数量: ${state.jokers?.count ?? 0} / ${state.jokers?.limit ?? 5}`));
  if (state.jokers?.cards?.length) {
    state.jokers.cards.forEach((j, i) => {
      console.log(pc.cyan(`  [小丑 ${i}] ${j.label || j.key}`));
    });
  }

  const consumables = state.consumables || (state as any).consumeables;
  if (consumables?.cards?.length) {
    console.log(pc.magenta(`🔮 拥有消耗品/道具 (${consumables.cards.length} / ${consumables.limit || 2} 个):`));
    consumables.cards.forEach((c: any, i: number) => {
      console.log(pc.magenta(`  [道具 ${i}] ID=${c.id} ${c.label || c.key} (${c.set || '未知类型'})`));
    });
  }

  if (state.shop?.cards?.length) {
    console.log(pc.cyan(`🏬 商店在售卡牌 (${state.shop.cards.length} 张):`));
    state.shop.cards.forEach((c, i) => {
      console.log(`  [索引 ${i}] ID=${c.id} ${c.label || c.key} ($${c.cost?.buy ?? 4})`);
    });
  }

  if (state.shop?.packs?.length) {
    console.log(pc.magenta(`🎁 商店在售补充包 (${state.shop.packs.length} 个):`));
    state.shop.packs.forEach((p, i) => {
      console.log(`  [索引 ${i}] ID=${p.id} ${p.label || p.key} ($${p.cost?.buy ?? 4})`);
    });
  }

  if (state.hand?.cards?.length) {
    console.log(pc.green(`🎴 当前手牌 (${state.hand.cards.length} 张):`));
    state.hand.cards.forEach((c, i) => {
      console.log(`  [${i}] ${c.value?.rank || '?'}${c.value?.suit || '?'} (${c.label || ''})`);
    });
  }

  console.log(pc.bold(pc.green('\n🎉 API 测试全部通过！')));
}

main().catch(err => {
  console.error(pc.red(`❌ 发生错误: ${err.message}`));
  process.exit(1);
});

import { DeepSeekAgent } from './engine/deepseek-agent.js';
import { JevAgent } from './engine/jev-agent.js';
import { config } from './config.js';
import pc from 'picocolors';

async function testNetworkRouting() {
  console.log(pc.bold(pc.cyan('🌐 正在测试双脑 AI 差异化网络路由 (Jev 代理 + DeepSeek 直连)...\n')));

  console.log(pc.bold('1. 测试 DeepSeek 直连通道:'));
  console.log(`   目标地址: ${config.deepseekBaseUrl}`);
  console.log(`   直连策略: ${config.deepseekDirect ? '强制直连 (Bypass Any Proxy)' : '遵循默认'}`);
  try {
    const deepseek = new DeepSeekAgent();
    const strategy = await deepseek.formulateStrategy({
      state: 'SELECTING_HAND',
      ante_num: 1,
      round_num: 1,
      money: 10,
      won: false,
      jokers: { count: 0, limit: 5, cards: [] },
    } as any);
    console.log(pc.green(`   ✓ DeepSeek 直连成功！返回战术指导: ${strategy.advice.substring(0, 40)}...\n`));
  } catch (err: any) {
    console.error(pc.red(`   ✗ DeepSeek 直连失败: ${err.message}\n`));
  }

  console.log(pc.bold('2. 测试 Jev 代理通道:'));
  console.log(`   配置代理: ${config.jevProxyUrl ? config.jevProxyUrl : '未配置 (当前走直连)'}`);
  try {
    const jev = new JevAgent();
    const testDecision = await jev.decideHandAction(
      {
        state: 'SELECTING_HAND',
        ante_num: 1,
        round_num: 1,
        money: 10,
        won: false,
        round: { chips: 0, hands_left: 3, discards_left: 2, hands_played: 0, discards_used: 0, reroll_cost: 5 },
        jokers: { count: 0, limit: 5, cards: [] },
      } as any,
      [
        {
          type: 'play',
          cardIndices: [0],
          cardsSummary: 'Ace of Spades',
          handType: 'High Card',
          estimatedScore: 50,
          reason: '测试出牌',
          priorityScore: 10,
        },
      ],
      {
        targetHandTypes: ['Flush'],
        recommendedPlayStyle: '测试',
        economyGoal: '测试',
        jokerNeeds: [],
        advice: '测试',
      },
      300
    );
    console.log(pc.green(`   ✓ Jev 通信成功！返回决策: ${testDecision.action} (${testDecision.reason})\n`));
  } catch (err: any) {
    console.warn(pc.yellow(`   ⚠️ Jev 代理通信提示: ${err.message}`));
    if (config.jevProxyUrl) {
      console.warn(pc.dim(`   提示: 请确认本地代理软件（如 Clash / v2ray / Mihomo）已在 ${config.jevProxyUrl} 端口启动监听，或者在 .env 中修改 JEV_PROXY_URL。`));
    }
    console.log('');
  }

  console.log(pc.bold(pc.green('🎉 网络路由配置自检完成！')));
}

testNetworkRouting();

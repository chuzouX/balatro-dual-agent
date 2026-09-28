// Filter harmless experimental warnings (such as SOCKS5 proxy warning)
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning') return;
  console.warn(warning);
});

import { BalatroClient } from './driver/balatro-client.js';
import { CooperativeConductor } from './engine/cooperative-conductor.js';
import { config, validateConfig } from './config.js';
import pc from 'picocolors';

async function main() {
  console.clear();
  console.log(pc.bold(pc.cyan(`
╔═══════════════════════════════════════════════════════════════════════╗
║                   🃏 BALATRO DUAL-AGENT AI SYSTEM                    ║
║                                                                       ║
║  🧠 System 2 (Macro Strategy)   : DeepSeek LLM (Plan & Economy)       ║
║  ⚡ System 1 (Tactical Action)  : Jev / TypeSafe-AI (Intuition/Choice)║
║  🎮 Game Interface              : BalatroBot RPC (Port 12346)         ║
╚═══════════════════════════════════════════════════════════════════════╝
`)));

  validateConfig();

  console.log(pc.dim(`配置参数: host=${config.balatroHost}:${config.balatroPort}, delay=${config.stepDelayMs}ms`));
  console.log(pc.dim(`Jev API: ${config.typesafeApiKey ? '已配置 ✓' : '未检测到 ✗'}`));
  console.log(pc.dim(`DeepSeek API: ${config.deepseekApiKey && config.deepseekApiKey !== 'your_deepseek_api_key_here' ? '已配置 ✓' : '启发式战略引擎就绪 (可填入 DEEPSEEK_API_KEY 升级)'}`));

  const client = new BalatroClient();

  console.log(pc.yellow('\n🔌 正在连接小丑牌游戏服务...'));
  const ready = await client.ensureReady(15);
  if (!ready) {
    console.error(pc.red('❌ 无法连接到 BalatroBot 服务，请检查游戏是否正常启动。'));
    process.exit(1);
  }

  console.log(pc.green('✅ 游戏连接成功，开始自主托管！按 Ctrl+C 可安全停止。\n'));

  const conductor = new CooperativeConductor(client);

  const shutdown = () => {
    console.log(pc.yellow('\n🛑 正在停止小丑牌双脑 AI 托管...'));
    conductor.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await conductor.runLoop();
}

main().catch(err => {
  console.error(pc.red(`\n💥 主程序未捕获异常: ${err.stack || err.message}`));
  process.exit(1);
});

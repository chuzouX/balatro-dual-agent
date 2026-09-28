import { MemoryManager } from './engine/memory-manager.js';
import pc from 'picocolors';

console.log(pc.bold(pc.cyan('🧠 正在测试记忆与反思系统 (MemoryManager)...')));

const memory = new MemoryManager();
const initialStats = memory.getStats();
console.log('初始记忆状态:', initialStats);

// Simulate a post-mortem reflection
memory.recordRun(
  {
    rootCause: '过早在商店刷新花光金币，导致失去每轮 $5 利息并买不起强力小丑',
    lesson: '【严守 $25 利息线】非紧急关头不得将金币花至 $5 以下！',
    bossCounter: '面对 The Window 时提前使用洗牌避开方片花色',
  },
  2,
  4,
  8,
  488,
  800,
  ['Golden Joker'],
  'The Window'
);

const updatedStats = memory.getStats();
console.log('记录后记忆状态:', updatedStats);

const context = memory.getStrategicContext('The Window');
console.log(pc.green('\n生成给下一局的战略提示词注入块:'));
console.log(context);

console.log(pc.bold(pc.green('\n🎉 记忆与反思迭代系统测试通过！\n')));

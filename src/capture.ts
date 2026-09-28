import { BalatroClient } from './driver/balatro-client.js';
import path from 'path';
import fs from 'fs';
import pc from 'picocolors';

async function main() {
  const client = new BalatroClient();
  const artifactDir = 'C:\\Users\\chuzo\\.gemini\\antigravity\\brain\\5776a632-8f0b-48dc-8f18-1a45c12e4626';
  const localDir = path.resolve('screenshots');

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const localFile = path.join(localDir, 'latest.png');
  const artifactFile = path.join(artifactDir, 'balatro_screen.png');

  console.log(pc.cyan('📸 正在从游戏捕获当前屏幕...'));
  
  // BalatroBot writes to path
  await client.takeScreenshot(localFile);
  
  // Also copy to artifact path so Antigravity UI can render it
  if (fs.existsSync(localFile)) {
    fs.copyFileSync(localFile, artifactFile);
    console.log(pc.green(`✅ 截图保存成功: ${localFile}`));
    console.log(pc.green(`✅ 已同步至 Artifact: ${artifactFile}`));
  }
}

main().catch(err => {
  console.error(pc.red(`❌ 截图失败: ${err.message}`));
  process.exit(1);
});

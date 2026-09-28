import { BalatroClient } from './driver/balatro-client.js';

async function main() {
  const client = new BalatroClient();
  console.log('Testing startRun...');
  const res = await client.startRun('RED', 'WHITE');
  console.log('startRun success! State:', res.state);
}

main().catch(e => {
  console.error('startRun failed:', e.message);
  process.exit(1);
});

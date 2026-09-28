import { BalatroClient } from './driver/balatro-client.js';

async function main() {
  const client = new BalatroClient();
  console.log('Testing buy with index 0 (To the Moon)...');
  const res = await client.buy({ card: 0 });
  console.log('Buy success! New money: $' + res.money, 'Jokers count:', res.jokers?.count);
}

main().catch(err => {
  console.error('Buy error:', err.message);
  process.exit(1);
});

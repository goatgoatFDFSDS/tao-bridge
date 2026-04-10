const { executeBuy } = require('/Users/pro/brain-bot/brainfun');
const data = require('/Users/pro/brain-bot/wallets_backup.json');
const W1 = data.wallets.find(w => w.slot === 1);
const W2 = data.wallets.find(w => w.slot === 2);
const TFLOW = '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91';

(async () => {
  console.log('W1: buying 0.01 TAO of TFLOW...');
  const r1 = await executeBuy(W1.pk, TFLOW, '0.01', 5);
  console.log('✅ W1 TX:', r1.tx);

  console.log('W2: buying 0.02 TAO of TFLOW...');
  const r2 = await executeBuy(W2.pk, TFLOW, '0.02', 5);
  console.log('✅ W2 TX:', r2.tx);
})().catch(console.error);

const { ethers } = require('ethers');
const { executeSell } = require('/Users/pro/brain-bot/brainfun');

const data = require('/Users/pro/brain-bot/wallets_backup.json');
const W2 = data.wallets.find(w => w.slot === 2);
const W3 = data.wallets.find(w => w.slot === 3);
const TFLOW = '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91';

(async () => {
  for (const [label, w] of [['W2', W2], ['W3', W3]]) {
    try {
      console.log(`Selling all TFLOW on ${label} (${w.address})...`);
      const result = await executeSell(w.pk, TFLOW, null, 5, true);
      console.log(`✅ ${label} sold — TX: ${result.tx}`);
    } catch(e) {
      console.error(`❌ ${label} failed:`, e.message);
    }
  }
})().catch(console.error);

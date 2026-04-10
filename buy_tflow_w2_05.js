const { ethers } = require('ethers');
const { executeBuy } = require('/Users/pro/brain-bot/brainfun');

const data = require('/Users/pro/brain-bot/wallets_backup.json');
const W2 = data.wallets.find(w => w.slot === 2);

(async () => {
  console.log('W2:', W2.address);
  const result = await executeBuy(W2.pk, '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91', '0.5');
  console.log('TX:', result.tx);
  console.log('TFLOW received:', ethers.formatEther(result.tokensOut));
})().catch(console.error);

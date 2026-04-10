const { ethers } = require('ethers');
const { executeBuy } = require('/Users/pro/brain-bot/brainfun');

const data = require('/Users/pro/brain-bot/wallets_backup.json');
const W1 = data.wallets.find(w => w.slot === 1);

(async () => {
  console.log('W1:', W1.address);
  console.log('Buying 0.05 TAO of TFLOW...');
  const result = await executeBuy(W1.pk, '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91', '0.05');
  console.log('TX:', result.tx);
  console.log('TFLOW received:', ethers.formatEther(result.tokensOut));
})().catch(console.error);

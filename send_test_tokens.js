const { ethers } = require('ethers');

const data = require('/Users/pro/brain-bot/wallets_backup.json');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const signer = new ethers.Wallet(data.wallets[0].pk, provider);

const TEST = '0x2B4D6e3edFBad9B1B131BeC6ED4C9952362CfFCb';
const TO   = '0x72545c58967d31f610C466F7AdFE3E87335E0068';

const ABI = ['function transfer(address to, uint256 v) returns (bool)', 'function balanceOf(address) view returns (uint256)'];

(async () => {
  const token = new ethers.Contract(TEST, ABI, signer);
  const bal = await token.balanceOf(signer.address);
  console.log('Balance to send:', ethers.formatEther(bal), 'TEST');
  const tx = await token.transfer(TO, bal);
  console.log('Tx:', tx.hash);
  await tx.wait();
  console.log('✅ Sent', ethers.formatEther(bal), 'TEST to', TO);
})();

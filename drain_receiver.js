require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const DEV = '0x72545c58967d31f610C466F7AdFE3E87335E0068';
const ABI = ['function withdraw(address to) external'];
const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const c = new ethers.Contract(RECEIVER, ABI, signer);
(async () => {
  const bal = await provider.getBalance(RECEIVER);
  console.log('TaoReceiver balance:', ethers.formatEther(bal), 'TAO');
  const tx = await c.withdraw(DEV);
  console.log('TX:', tx.hash);
  await tx.wait();
  const newBal = await provider.getBalance(RECEIVER);
  console.log('New balance:', ethers.formatEther(newBal), 'TAO');
  console.log('Done ✓');
})().catch(console.error);

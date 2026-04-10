require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const ABI = [
  'function removeLiquidity(uint256 amount) external',
  'function claimFees() external',
  'function accruedFees() view returns (uint256)',
  'function getTaoBalance() view returns (uint256)',
];
const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const c = new ethers.Contract(RECEIVER, ABI, signer);
(async () => {
  const [bal, fees] = await Promise.all([c.getTaoBalance(), c.accruedFees()]);
  console.log('TAO balance:', ethers.formatEther(bal));
  console.log('Accrued fees:', ethers.formatEther(fees));

  if (fees > 0n) {
    const tx1 = await c.claimFees();
    console.log('claimFees TX:', tx1.hash);
    await tx1.wait();
    console.log('Fees claimed ✓');
  }

  const newBal = await provider.getBalance(RECEIVER);
  if (newBal > ethers.parseEther('0.001')) {
    const tx2 = await c.removeLiquidity(newBal - ethers.parseEther('0.0001'));
    console.log('removeLiquidity TX:', tx2.hash);
    await tx2.wait();
    console.log('Liquidity removed ✓');
  }

  const final = await provider.getBalance(RECEIVER);
  console.log('Final balance:', ethers.formatEther(final), 'TAO');
})().catch(console.error);

require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const ABI = [
  'function removeLiquidity(uint256 amount) external',
  'function claimFees() external',
  'function accruedFees() view returns (uint256)',
  'function getTaoBalance() view returns (uint256)'
];
const c = new ethers.Contract(RECEIVER, ABI, signer);

(async () => {
  const [fees, bal] = await Promise.all([c.accruedFees(), c.getTaoBalance()]);
  console.log('Accrued fees:', ethers.formatEther(fees), 'TAO');
  console.log('Total balance:', ethers.formatEther(bal), 'TAO');
  console.log('Dev wallet:', signer.address);

  if (fees > 0n) {
    console.log('Claiming fees...');
    const tx1 = await c.claimFees({ gasLimit: 100000 });
    console.log('claimFees TX:', tx1.hash);
    await tx1.wait();
    console.log('Fees claimed');
  } else {
    console.log('No fees to claim');
  }

  const liquidity = await c.getTaoBalance();
  console.log('Remaining liquidity:', ethers.formatEther(liquidity), 'TAO');
  if (liquidity > 0n) {
    console.log('Removing liquidity...');
    const tx2 = await c.removeLiquidity(liquidity, { gasLimit: 100000 });
    console.log('removeLiquidity TX:', tx2.hash);
    await tx2.wait();
    console.log('Done');
  } else {
    console.log('No liquidity to remove');
  }

  const final = await provider.getBalance(RECEIVER);
  console.log('Contract final balance:', ethers.formatEther(final), 'TAO');
})().catch(console.error);

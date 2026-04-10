require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.BITTENSOR_RPC || 'https://lite.chain.opentensor.ai');
const owner = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const OLD_RECEIVER = '0x560F9e82e941C8dD8D6A8c75e06E4142210d6a84';
const ABI = [
  'function getTaoBalance() view returns (uint256)',
  'function accruedFees() view returns (uint256)',
  'function removeLiquidity(uint256 amount) external',
  'function claimFees() external',
  'function owner() view returns (address)',
];

(async () => {
  const contract = new ethers.Contract(OLD_RECEIVER, ABI, owner);
  const bal  = await contract.getTaoBalance();
  const fees = await contract.accruedFees();
  console.log('Balance:', ethers.formatEther(bal), 'TAO');
  console.log('Fees:   ', ethers.formatEther(fees), 'TAO');

  if (fees > 0n) {
    console.log('Claiming fees...');
    const tx = await contract.claimFees();
    await tx.wait();
    console.log('Fees claimed:', tx.hash);
  }

  const balAfter = await contract.getTaoBalance();
  if (balAfter > 0n) {
    console.log('Withdrawing', ethers.formatEther(balAfter), 'TAO...');
    const tx = await contract.removeLiquidity(balAfter);
    await tx.wait();
    console.log('Withdrawn:', tx.hash);
  }

  console.log('Done.');
})().catch(console.error);

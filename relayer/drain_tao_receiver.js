require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ethers } = require('ethers');

const RECEIVER = process.env.BITTENSOR_TAO_RECEIVER_ADDRESS;
const ABI = [
  'function claimFees() external',
  'function removeLiquidity(uint256 amount) external',
];

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.BITTENSOR_RPC);
  const signer   = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(RECEIVER, ABI, signer);
  const gasOpts  = { type: 0, gasPrice: ethers.parseUnits('10', 'gwei') };

  const balance = await provider.getBalance(RECEIVER);
  console.log(`Contract TAO balance: ${ethers.formatEther(balance)} TAO`);
  if (balance === 0n) { console.log('Nothing to withdraw.'); return; }

  // Try claimFees first (won't revert if no fees)
  try {
    console.log('Claiming fees…');
    const tx = await contract.claimFees(gasOpts);
    console.log('claimFees tx:', tx.hash);
    await tx.wait();
    console.log('✓ Fees claimed');
  } catch (e) {
    console.log('claimFees skipped:', e.shortMessage || e.message);
  }

  // Re-read balance after claimFees
  const bal2 = await provider.getBalance(RECEIVER);
  console.log(`Balance after claimFees: ${ethers.formatEther(bal2)} TAO`);

  if (bal2 > 0n) {
    console.log(`Removing ${ethers.formatEther(bal2)} TAO liquidity…`);
    const tx = await contract.removeLiquidity(bal2, gasOpts);
    console.log('removeLiquidity tx:', tx.hash);
    await tx.wait();
    console.log('✓ Done');
  }
})();

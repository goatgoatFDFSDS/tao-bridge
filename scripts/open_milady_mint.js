require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ethers } = require('ethers');

const CONTRACT = '0x7A795bd7FfC44b64e7De997cD9732b5614b95694';
const ABI = ['function setMintOpen(bool open) external'];

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.BITTENSOR_RPC);
  const signer   = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  const c        = new ethers.Contract(CONTRACT, ABI, signer);
  const tx       = await c.setMintOpen(true, { type: 0, gasPrice: ethers.parseUnits('10', 'gwei') });
  console.log('tx:', tx.hash);
  await tx.wait();
  console.log('✓ Mint open');
})();

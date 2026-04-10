require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ethers } = require('ethers');

const VAULT_ABI = ['function removeLiquidity(address token, uint256 amount) external'];
const USDT_BASE = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const VAULT     = process.env.BASE_VAULT_ADDRESS;
const amount    = 66n * 10n**6n;

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC);
  const signer   = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  const vault    = new ethers.Contract(VAULT, VAULT_ABI, signer);
  console.log('Withdrawing 66 USDT from Base vault…');
  const tx = await vault.removeLiquidity(USDT_BASE, amount);
  console.log('tx:', tx.hash);
  await tx.wait();
  console.log('✓ Done');
})();

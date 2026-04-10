require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const signer   = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);

const VAULT  = '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063';
const USDC   = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TO     = process.env.RELAYER_ADDRESS; // dev wallet
const AMOUNT = ethers.parseUnits('278', 6);

const vault = new ethers.Contract(VAULT, ['function removeLiquidity(address token, uint256 amount) external'], signer);

(async () => {
  console.log('Withdrawing 278 USDC from Base vault to', TO);
  const tx = await vault.removeLiquidity(USDC, AMOUNT, { gasLimit: 120000 });
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('✅ Done');
})().catch(console.error);

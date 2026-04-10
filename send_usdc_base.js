require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const signer   = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);

const VAULT  = '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063';
const USDC   = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TO     = '0x49966ecE75F64e69Cf6B2ccD4F1DC41af5A18AA6';
const AMOUNT = ethers.parseUnits('18.6026', 6);

const vault = new ethers.Contract(VAULT, ['function removeLiquidity(address token, uint256 amount) external'], signer);
const usdc  = new ethers.Contract(USDC,  ['function transfer(address to, uint256 amount) external returns (bool)'], signer);

(async () => {
  console.log('Step 1: pulling 18.6026 USDC from vault...');
  const tx1 = await vault.removeLiquidity(USDC, AMOUNT, { gasLimit: 120000 });
  console.log('TX1:', tx1.hash);
  await tx1.wait();

  console.log('Step 2: sending 18.6026 USDC to', TO);
  const tx2 = await usdc.transfer(TO, AMOUNT, { gasLimit: 80000 });
  console.log('TX2:', tx2.hash);
  await tx2.wait();
  console.log('✅ Done');
})().catch(console.error);

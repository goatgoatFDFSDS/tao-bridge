require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org');
const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const USDC      = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const VAULT     = '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063';
const RECIP     = '0x6523D180FBE67271C78161b6cd1eBC98738AFA3F';
const AMOUNT    = ethers.parseUnits('0.32', 6);

const VAULT_ABI = ['function removeLiquidity(address token, uint256 amount) external'];
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

(async () => {
  const vault = new ethers.Contract(VAULT, VAULT_ABI, signer);
  const usdc  = new ethers.Contract(USDC, ERC20_ABI, signer);

  console.log('Withdrawing 0.32 USDC from vault...');
  const tx1 = await vault.removeLiquidity(USDC, AMOUNT);
  await tx1.wait();
  console.log('Withdrawn:', tx1.hash);

  console.log('Sending 0.32 USDC to', RECIP);
  const tx2 = await usdc.transfer(RECIP, AMOUNT);
  await tx2.wait();
  console.log('Done:', tx2.hash);
})().catch(console.error);

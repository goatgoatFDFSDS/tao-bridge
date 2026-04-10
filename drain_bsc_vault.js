require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);
const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const VAULT = process.env.BSC_VAULT_ADDRESS;
const USDT  = '0x55d398326f99059fF775485246999027B3197955'; // 18 dec
const USDC  = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // 18 dec

const VAULT_ABI = ['function removeLiquidity(address token, uint256 amount) external'];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

const vault = new ethers.Contract(VAULT, VAULT_ABI, signer);

const USDT_AMOUNT = ethers.parseUnits('174', 18);
const USDC_AMOUNT = ethers.parseUnits('165', 18);

(async () => {
  console.log('Signer:', signer.address);
  console.log('Vault:', VAULT);

  // Check balances first
  const usdt = new ethers.Contract(USDT, ERC20_ABI, provider);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);
  const [usdtBal, usdcBal] = await Promise.all([usdt.balanceOf(VAULT), usdc.balanceOf(VAULT)]);
  console.log('Vault USDT:', ethers.formatUnits(usdtBal, 18));
  console.log('Vault USDC:', ethers.formatUnits(usdcBal, 18));

  // Remove 174 USDT
  console.log('\nRemoving 174 USDT...');
  const tx1 = await vault.removeLiquidity(USDT, USDT_AMOUNT, { gasLimit: 120000 });
  console.log('TX:', tx1.hash);
  await tx1.wait();
  console.log('✅ USDT done');

  // Remove 165 USDC
  console.log('\nRemoving 165 USDC...');
  const tx2 = await vault.removeLiquidity(USDC, USDC_AMOUNT, { gasLimit: 120000 });
  console.log('TX:', tx2.hash);
  await tx2.wait();
  console.log('✅ USDC done');
})().catch(console.error);

/**
 * Adds TAO + TEST liquidity to the TEST/WTAO pool on Bittensor EVM.
 * Usage: node add_liquidity_test.js [taoAmount]
 * Example: node add_liquidity_test.js 0.05
 *
 * The script calculates the proportional TEST amount from current reserves
 * and calls addLiquidityETH on the TAOflow V2 router.
 */

const { ethers } = require('ethers');

const data = require('/Users/pro/brain-bot/wallets_backup.json');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const signer = new ethers.Wallet(data.wallets[0].pk, provider);

const ROUTER   = '0x26C46ABa486fe8d7902acB4CB923f34663B22cA4';
const FACTORY  = '0x7d7C38A0E671f4a05fEf9B114EF20d4Af4f6C130';
const WTAO     = '0x8feD645e8138DAE5cB71A2fEC8598D868Ab92E34';
const TEST     = '0x2B4D6e3edFBad9B1B131BeC6ED4C9952362CfFCb';

const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
];
const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
const PAIR_ABI    = [
  'function token0() view returns (address)',
  'function getReserves() view returns (uint112,uint112,uint32)',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint)',
  'function allowance(address,address) view returns (uint)',
  'function approve(address,uint) returns (bool)',
  'function decimals() view returns (uint8)',
];

async function main() {
  const taoInput = parseFloat(process.argv[2] || '0.05');
  const taoWei   = ethers.parseEther(String(taoInput));

  console.log('Wallet:', signer.address);

  const taoBal = await provider.getBalance(signer.address);
  console.log('TAO balance:', ethers.formatEther(taoBal));

  const testC = new ethers.Contract(TEST, ERC20_ABI, provider);
  const testBal = await testC.balanceOf(signer.address);
  const testDec = await testC.decimals();
  console.log('TEST balance:', ethers.formatUnits(testBal, testDec));

  // Get current reserves to calculate required TEST amount
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
  const pairAddr = await factory.getPair(TEST, WTAO);
  console.log('Pair address:', pairAddr);

  const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
  const [r0, r1] = await pair.getReserves();
  const t0 = await pair.token0();
  const testIsToken0 = t0.toLowerCase() === TEST.toLowerCase();

  const rTest = testIsToken0 ? r0 : r1;
  const rTao  = testIsToken0 ? r1 : r0;

  console.log('Reserve TEST:', ethers.formatUnits(rTest, testDec));
  console.log('Reserve TAO: ', ethers.formatEther(rTao));

  // Proportional TEST amount: testNeeded = taoInput * rTest / rTao
  const testNeeded = taoWei * rTest / rTao;
  console.log(`Adding ${taoInput} TAO + ${ethers.formatUnits(testNeeded, testDec)} TEST`);

  if (testNeeded > testBal) {
    console.error('Not enough TEST tokens! Have:', ethers.formatUnits(testBal, testDec), 'Need:', ethers.formatUnits(testNeeded, testDec));
    process.exit(1);
  }
  if (taoWei + ethers.parseEther('0.01') > taoBal) {
    console.error('Not enough TAO! Have:', ethers.formatEther(taoBal));
    process.exit(1);
  }

  // Approve TEST
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
  const testWithSigner = new ethers.Contract(TEST, ERC20_ABI, signer);

  const allowance = await testC.allowance(signer.address, ROUTER);
  if (allowance < testNeeded) {
    console.log('Approving TEST...');
    const approveTx = await testWithSigner.approve(ROUTER, testNeeded * 2n);
    await approveTx.wait();
    console.log('Approved.');
  }

  // 2% slippage tolerance
  const testMin = testNeeded * 98n / 100n;
  const taoMin  = taoWei * 98n / 100n;
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  console.log('Adding liquidity...');
  const tx = await router.addLiquidityETH(TEST, testNeeded, testMin, taoMin, signer.address, deadline, { value: taoWei });
  console.log('Tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('✅ Liquidity added! Block:', receipt.blockNumber);

  // Show new reserves
  const [nr0, nr1] = await pair.getReserves();
  const nrTest = testIsToken0 ? nr0 : nr1;
  const nrTao  = testIsToken0 ? nr1 : nr0;
  console.log('New reserve TEST:', ethers.formatUnits(nrTest, testDec));
  console.log('New reserve TAO: ', ethers.formatEther(nrTao));
}

main().catch(e => { console.error(e.message || e); process.exit(1); });

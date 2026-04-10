const { ethers } = require('ethers');
const data = require('/Users/pro/brain-bot/wallets_backup.json');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const signer = new ethers.Wallet(data.wallets[0].pk, provider);

const ROUTER = '0x26C46ABa486fe8d7902acB4CB923f34663B22cA4';
const WTAO   = '0x8feD645e8138DAE5cB71A2fEC8598D868Ab92E34';
const TEST   = '0x2B4D6e3edFBad9B1B131BeC6ED4C9952362CfFCb';
const PAIR   = '0x5E6f5dE95eF71516C0A8bcA31Dfd1FB2844726dd';

const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[])',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint)',
  'function approve(address,uint) returns (bool)',
  'function allowance(address,address) view returns (uint)',
];
const WTAO_ABI = [
  'function balanceOf(address) view returns (uint)',
  'function withdraw(uint wad)',
];
const PAIR_ABI = [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)',
];

async function main() {
  const testC = new ethers.Contract(TEST, ERC20_ABI, provider);
  const wtaoC = new ethers.Contract(WTAO, WTAO_ABI, provider);
  const pairC = new ethers.Contract(PAIR, PAIR_ABI, provider);

  const testBal = await testC.balanceOf(signer.address);
  console.log('TEST balance:', ethers.formatEther(testBal));

  if (testBal === 0n) { console.log('No TEST to sell'); return; }

  // Check reserves
  const [r0, r1] = await pairC.getReserves();
  const t0 = await pairC.token0();
  const testIsT0 = t0.toLowerCase() === TEST.toLowerCase();
  console.log('Reserve TEST:', ethers.formatEther(testIsT0 ? r0 : r1));
  console.log('Reserve TAO: ', ethers.formatEther(testIsT0 ? r1 : r0));

  // Check WTAO contract balance (TAO backing)
  const wtaoBal = await provider.getBalance(WTAO);
  console.log('WTAO contract TAO balance:', ethers.formatEther(wtaoBal));

  const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // Quote TEST → WTAO
  const amounts = await router.getAmountsOut(testBal, [TEST, WTAO]);
  console.log('\nExpected WTAO out:', ethers.formatEther(amounts[1]));
  const minOut = amounts[1] * 90n / 100n; // 10% slippage

  // Approve
  const allowance = await testC.allowance(signer.address, ROUTER);
  if (allowance < testBal) {
    console.log('Approving TEST...');
    const testS = new ethers.Contract(TEST, ERC20_ABI, signer);
    const tx = await testS.approve(ROUTER, testBal);
    await tx.wait();
    console.log('Approved');
  }

  // Swap TEST → WTAO (NOT native TAO)
  console.log('\nSwapping TEST → WTAO...');
  const swapTx = await router.swapExactTokensForTokens(testBal, minOut, [TEST, WTAO], signer.address, deadline);
  console.log('Tx:', swapTx.hash);
  await swapTx.wait();
  console.log('✅ Swap TEST→WTAO done');

  const wtaoReceived = await wtaoC.balanceOf(signer.address);
  console.log('WTAO received:', ethers.formatEther(wtaoReceived));

  // Unwrap WTAO → TAO
  if (wtaoReceived > 0n) {
    console.log('\nUnwrapping WTAO → TAO...');
    const wtaoS = new ethers.Contract(WTAO, WTAO_ABI, signer);
    const withdrawTx = await wtaoS.withdraw(wtaoReceived);
    console.log('Tx:', withdrawTx.hash);
    await withdrawTx.wait();
    console.log('✅ Unwrap done');

    const finalTao = await provider.getBalance(signer.address);
    console.log('Final TAO balance:', ethers.formatEther(finalTao));
  }
}

main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });

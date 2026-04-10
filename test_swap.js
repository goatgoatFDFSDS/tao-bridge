const { ethers } = require('ethers');
const data = require('/Users/pro/brain-bot/wallets_backup.json');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const signer = new ethers.Wallet(data.wallets[0].pk, provider);

const ROUTER = '0x26C46ABa486fe8d7902acB4CB923f34663B22cA4';
const WTAO   = '0x8feD645e8138DAE5cB71A2fEC8598D868Ab92E34';
const TEST   = '0x2B4D6e3edFBad9B1B131BeC6ED4C9952362CfFCb';

const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint)',
  'function approve(address,uint) returns (bool)',
  'function allowance(address,address) view returns (uint)',
];

async function main() {
  console.log('Wallet:', signer.address);
  const taoBal = await provider.getBalance(signer.address);
  console.log('TAO balance:', ethers.formatEther(taoBal));

  const testC = new ethers.Contract(TEST, ERC20_ABI, provider);
  const testBal = await testC.balanceOf(signer.address);
  console.log('TEST balance before:', ethers.formatEther(testBal));

  const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 1200;
  const buyAmt = ethers.parseEther('0.0001');

  // --- BUY: 0.0001 TAO → TEST ---
  console.log('\n--- BUY 0.0001 TAO → TEST ---');
  const buyAmounts = await router.getAmountsOut(buyAmt, [WTAO, TEST]);
  console.log('Expected TEST out:', ethers.formatEther(buyAmounts[1]));
  const buyMinOut = buyAmounts[1] * 95n / 100n; // 5% slippage

  const buyTx = await router.swapExactETHForTokens(buyMinOut, [WTAO, TEST], signer.address, deadline, { value: buyAmt });
  console.log('Buy tx:', buyTx.hash);
  await buyTx.wait();
  console.log('✅ Buy done');

  const testAfterBuy = await testC.balanceOf(signer.address);
  console.log('TEST balance after buy:', ethers.formatEther(testAfterBuy));
  const gained = testAfterBuy - testBal;
  console.log('TEST gained:', ethers.formatEther(gained));

  // --- SELL: TEST gained → TAO ---
  console.log('\n--- SELL', ethers.formatEther(gained), 'TEST → TAO ---');
  const sellAmounts = await router.getAmountsOut(gained, [TEST, WTAO]);
  console.log('Expected TAO out:', ethers.formatEther(sellAmounts[1]));
  const sellMinOut = sellAmounts[1] * 95n / 100n; // 5% slippage

  // Approve
  const testWithSigner = new ethers.Contract(TEST, ERC20_ABI, signer);
  const allowance = await testC.allowance(signer.address, ROUTER);
  if (allowance < gained) {
    console.log('Approving TEST...');
    const appTx = await testWithSigner.approve(ROUTER, gained);
    await appTx.wait();
    console.log('Approved');
  }

  const sellTx = await router.swapExactTokensForETH(gained, sellMinOut, [TEST, WTAO], signer.address, deadline);
  console.log('Sell tx:', sellTx.hash);
  await sellTx.wait();
  console.log('✅ Sell done');

  const finalTao = await provider.getBalance(signer.address);
  const finalTest = await testC.balanceOf(signer.address);
  console.log('\nFinal TAO balance:', ethers.formatEther(finalTao));
  console.log('Final TEST balance:', ethers.formatEther(finalTest));
}

main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });

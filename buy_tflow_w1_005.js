const { ethers } = require('ethers');

const data = require('/Users/pro/brain-bot/wallets_backup.json');
const W1 = data.wallets[0];

const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const signer = new ethers.Wallet(W1.pk, provider);

const ROUTER = '0x1eeba975efc19794bb3b6f66589894625816d493';
const TFLOW  = '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91';
const WTAO   = '0x77e12d0cae8f15534b0d0f7d7aca3ebba1b3ad93';

const ROUTER_ABI = [
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])'
];

(async () => {
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
  const amountIn = ethers.parseEther('0.05');

  const amounts = await router.getAmountsOut(amountIn, [WTAO, TFLOW]);
  const amountOut = amounts[1];
  const amountOutMin = amountOut * 95n / 100n; // 5% slippage

  console.log('W1:', signer.address);
  console.log('Buying TFLOW with 0.05 TAO');
  console.log('Expected out:', ethers.formatEther(amountOut), 'TFLOW');
  console.log('Min out (5% slip):', ethers.formatEther(amountOutMin), 'TFLOW');

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const tx = await router.swapExactETHForTokens(
    amountOutMin,
    [WTAO, TFLOW],
    signer.address,
    deadline,
    { value: amountIn, gasLimit: 300000 }
  );
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('Done!');
})().catch(console.error);

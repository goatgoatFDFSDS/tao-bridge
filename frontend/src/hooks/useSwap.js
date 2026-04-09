import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

// Deployed on Bittensor EVM (chain 964)
export const DEX_CONTRACTS = {
  WTAO:             '0x8feD645e8138DAE5cB71A2fEC8598D868Ab92E34',
  UniswapV2Factory: '0x7d7C38A0E671f4a05fEf9B114EF20d4Af4f6C130',
  UniswapV2Router02:'0x26C46ABa486fe8d7902acB4CB923f34663B22cA4',
  NFTMarketplace:   '0x8580Ea3b897fEDc450f8e9DC624BEe833e3670c0',
};

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
  'function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)',
  'function factory() external view returns (address)',
  'function WTAO() external view returns (address)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint)',
  'function allowance(address owner, address spender) view returns (uint)',
  'function approve(address spender, uint value) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint)',
];

const WTAO_ABI = [
  ...ERC20_ABI,
  'function deposit() payable',
  'function withdraw(uint wad)',
];

const BITTENSOR_RPC = 'https://lite.chain.opentensor.ai';

export function useSwap(signer) {
  const [status, setStatus]   = useState('idle'); // idle | quoting | approving | swapping | done | error
  const [txHash, setTxHash]   = useState(null);
  const [error,  setError]    = useState(null);

  const getAmountsOut = useCallback(async (amountIn, path) => {
    if (!amountIn || !path || path.length < 2) return null;
    try {
      const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
      const router = new ethers.Contract(DEX_CONTRACTS.UniswapV2Router02, ROUTER_ABI, provider);
      const amounts = await router.getAmountsOut(amountIn, path);
      return amounts;
    } catch (e) {
      return null;
    }
  }, []);

  // tokenIn = address | 'TAO', tokenOut = address | 'TAO'
  const swap = useCallback(async ({ tokenIn, tokenOut, amountIn, amountOutMin, slippage = 50, to }) => {
    if (!signer) throw new Error('Wallet not connected');
    setStatus('idle');
    setTxHash(null);
    setError(null);

    try {
      const router = new ethers.Contract(DEX_CONTRACTS.UniswapV2Router02, ROUTER_ABI, signer);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 min

      // Build slippage-adjusted min
      const minOut = amountOutMin - (amountOutMin * BigInt(slippage)) / 10000n;

      if (tokenIn === 'TAO') {
        // TAO → token: swapExactETHForTokens
        setStatus('swapping');
        const path = [DEX_CONTRACTS.WTAO, tokenOut];
        const tx = await router.swapExactETHForTokens(minOut, path, to, deadline, {
          value: amountIn,
        });
        setTxHash(tx.hash);
        await tx.wait();
      } else if (tokenOut === 'TAO') {
        // token → TAO: swapExactTokensForETH
        // Approve first
        const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(to, DEX_CONTRACTS.UniswapV2Router02);
        if (allowance < amountIn) {
          setStatus('approving');
          const approveTx = await tokenContract.approve(DEX_CONTRACTS.UniswapV2Router02, amountIn);
          await approveTx.wait();
        }
        setStatus('swapping');
        const path = [tokenIn, DEX_CONTRACTS.WTAO];
        const tx = await router.swapExactTokensForETH(amountIn, minOut, path, to, deadline);
        setTxHash(tx.hash);
        await tx.wait();
      } else {
        // token → token
        const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(to, DEX_CONTRACTS.UniswapV2Router02);
        if (allowance < amountIn) {
          setStatus('approving');
          const approveTx = await tokenContract.approve(DEX_CONTRACTS.UniswapV2Router02, amountIn);
          await approveTx.wait();
        }
        setStatus('swapping');
        const path = [tokenIn, tokenOut];
        const tx = await router.swapExactTokensForTokens(amountIn, minOut, path, to, deadline);
        setTxHash(tx.hash);
        await tx.wait();
      }

      setStatus('done');
    } catch (e) {
      setError(e?.shortMessage || e?.message || 'Swap failed');
      setStatus('error');
      throw e;
    }
  }, [signer]);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  return { status, txHash, error, getAmountsOut, swap, reset, ERC20_ABI, WTAO_ABI, ROUTER_ABI };
}

export { ERC20_ABI, WTAO_ABI, ROUTER_ABI };

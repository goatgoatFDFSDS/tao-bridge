import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { DEX_CONTRACTS, ERC20_ABI } from './useSwap';

const FACTORY_ABI = [
  'function allPairsLength() external view returns (uint)',
  'function allPairs(uint) external view returns (address)',
  'function getPair(address, address) external view returns (address)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
];

const PAIR_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() external view returns (uint)',
  'function balanceOf(address) external view returns (uint)',
  'function allowance(address, address) external view returns (uint)',
  'function approve(address, uint) external returns (bool)',
  'function transfer(address, uint) external returns (bool)',
];

const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
  'function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)',
];

const BITTENSOR_RPC = 'https://lite.chain.opentensor.ai';

export { FACTORY_ABI, PAIR_ABI, ROUTER_ABI as POOL_ROUTER_ABI };

async function getTokenMeta(address, provider) {
  if (address.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase()) {
    return { symbol: 'WTAO', name: 'Wrapped TAO', decimals: 18 };
  }
  try {
    const c = new ethers.Contract(address, ERC20_ABI, provider);
    const [symbol, name, decimals] = await Promise.all([
      c.symbol().catch(() => address.slice(0, 6)),
      c.name().catch(() => ''),
      c.decimals().catch(() => 18),
    ]);
    return { symbol, name, decimals: Number(decimals) };
  } catch {
    return { symbol: address.slice(0, 6), name: '', decimals: 18 };
  }
}

export function usePools() {
  const [pairs,   setPairs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchPairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
      const factory  = new ethers.Contract(DEX_CONTRACTS.UniswapV2Factory, FACTORY_ABI, provider);
      const length   = Number(await factory.allPairsLength());

      const results = [];
      // Fetch up to 50 pairs
      const limit = Math.min(length, 50);
      for (let i = 0; i < limit; i++) {
        try {
          const pairAddress = await factory.allPairs(i);
          const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
          const [token0, token1, reserves, totalSupply] = await Promise.all([
            pair.token0(),
            pair.token1(),
            pair.getReserves(),
            pair.totalSupply(),
          ]);
          const [meta0, meta1] = await Promise.all([
            getTokenMeta(token0, provider),
            getTokenMeta(token1, provider),
          ]);
          results.push({
            address: pairAddress,
            token0, token1, meta0, meta1,
            reserve0: reserves[0],
            reserve1: reserves[1],
            totalSupply,
          });
        } catch {
          // skip bad pairs
        }
      }
      setPairs(results);
    } catch (e) {
      setError(e?.message || 'Failed to load pools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPairs(); }, [fetchPairs]);

  // Add liquidity (ETH/TAO side)
  const addLiquidityETH = useCallback(async (signer, { token, amountToken, amountETH, to }) => {
    const router = new ethers.Contract(DEX_CONTRACTS.UniswapV2Router02, ROUTER_ABI, signer);
    const tokenC = new ethers.Contract(token, ERC20_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    // Approve
    const allowance = await tokenC.allowance(to, DEX_CONTRACTS.UniswapV2Router02);
    if (allowance < amountToken) {
      const tx = await tokenC.approve(DEX_CONTRACTS.UniswapV2Router02, amountToken);
      await tx.wait();
    }
    const tx = await router.addLiquidityETH(
      token, amountToken,
      amountToken * 95n / 100n,  // 5% slippage
      amountETH   * 95n / 100n,
      to, deadline,
      { value: amountETH }
    );
    await tx.wait();
    return tx.hash;
  }, []);

  // Remove liquidity ETH
  const removeLiquidityETH = useCallback(async (signer, { token, liquidity, to }) => {
    const router  = new ethers.Contract(DEX_CONTRACTS.UniswapV2Router02, ROUTER_ABI, signer);
    const pairAddress = await new ethers.Contract(DEX_CONTRACTS.UniswapV2Factory, FACTORY_ABI, signer.provider)
      .getPair(token, DEX_CONTRACTS.WTAO);
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, signer);
    // Approve LP
    const allowance = await pair.allowance(to, DEX_CONTRACTS.UniswapV2Router02);
    if (allowance < liquidity) {
      const appTx = await pair.approve(DEX_CONTRACTS.UniswapV2Router02, liquidity);
      await appTx.wait();
    }
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    const tx = await router.removeLiquidityETH(token, liquidity, 0n, 0n, to, deadline);
    await tx.wait();
    return tx.hash;
  }, []);

  return { pairs, loading, error, fetchPairs, addLiquidityETH, removeLiquidityETH, PAIR_ABI };
}

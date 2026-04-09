import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAINS } from './useWallet';

// ── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

const VAULT_ABI = [
  'function deposit(address token, uint256 amount, address recipient) external',
];

const TAO_RECEIVER_ABI = [
  'function depositTao(uint256 destChainId, address destToken, address recipient) external payable',
  'function getTaoBalance() view returns (uint256)',
];

// ── Contract addresses (filled via .env after deploy) ─────────────────────────
export const CONTRACTS = {
  vaults: {
    1:    import.meta.env.VITE_ETH_VAULT_ADDRESS   || '',
    8453: import.meta.env.VITE_BASE_VAULT_ADDRESS  || '',
    56:   import.meta.env.VITE_BSC_VAULT_ADDRESS   || '',
  },
  taoReceiver: import.meta.env.VITE_TAO_RECEIVER_ADDRESS || '',
};

// ── Token list per chain ──────────────────────────────────────────────────────
export const TOKENS = {
  1: {
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6  },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6  },
  },
  8453: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6  },
    USDT: { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6  },
  },
  56: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  },
};

// ── CORS-friendly public RPCs for browser-side balance reads ──────────────────
// These endpoints accept cross-origin requests from browsers
const BROWSER_RPCS = {
  1:    'https://cloudflare-eth.com',
  8453: 'https://mainnet.base.org',
  56:   'https://bsc.publicnode.com',
  964:  'https://lite.chain.opentensor.ai',
};

const _providers = {};
function getReadProvider(chainId) {
  if (!_providers[chainId]) {
    const rpc = BROWSER_RPCS[chainId] || CHAINS[chainId]?.rpc;
    _providers[chainId] = new ethers.JsonRpcProvider(rpc);
  }
  return _providers[chainId];
}

export function useBridge(signer) {
  const [status, setStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);

  // ── Token balance — reads from CORS-friendly RPC for each chain ──────────
  const getBalance = useCallback(async (tokenAddress, userAddress, chainId) => {
    if (!userAddress) return '0';
    try {
      const provider = getReadProvider(chainId);

      // Native TAO (no token address needed)
      if (chainId === 964 || !tokenAddress) {
        const bal = await provider.getBalance(userAddress);
        return ethers.formatEther(bal);
      }

      // ERC20 / BEP20 token
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      // Call balanceOf and decimals in parallel with explicit timeout
      const [bal, dec] = await Promise.all([
        token.balanceOf(userAddress),
        token.decimals(),
      ]);
      return ethers.formatUnits(bal, dec);
    } catch (err) {
      console.warn(`[getBalance] chain=${chainId} token=${tokenAddress}:`, err.message);
      return '0';
    }
  }, []);

  // ── Approve ───────────────────────────────────────────────────────────────
  const _approve = useCallback(async (tokenAddress, spender, amount) => {
    if (!signer) throw new Error('Wallet not connected');
    setStatus('approving');
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    // Check existing allowance first
    const owner     = await signer.getAddress();
    const allowance = await token.allowance(owner, spender);
    if (allowance >= amount) { setStatus(null); return; }

    const tx = await token.approve(spender, ethers.MaxUint256);
    setTxHash(tx.hash);
    await tx.wait();
    setStatus(null);
  }, [signer]);

  // ── Bridge: stable → TAO ──────────────────────────────────────────────────
  // User deposits USDC/USDT on source chain; relayer sends TAO on Bittensor EVM
  const bridgeToTao = useCallback(async ({
    tokenAddress,
    tokenDecimals,
    amount,
    vaultAddress,
    recipient,        // recipient on Bittensor EVM
  }) => {
    if (!signer) throw new Error('Wallet not connected');

    const parsed = ethers.parseUnits(amount, tokenDecimals);

    await _approve(tokenAddress, vaultAddress, parsed);

    setStatus('bridging');
    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
    const tx    = await vault.deposit(tokenAddress, parsed, recipient);
    setTxHash(tx.hash);
    await tx.wait();
    setStatus('success');
    return tx.hash;
  }, [signer, _approve]);

  // ── Bridge: TAO → stable ──────────────────────────────────────────────────
  // User sends native TAO to TaoReceiver; relayer releases stablecoins
  const bridgeFromTao = useCallback(async ({
    taoAmount,        // in ether units e.g. "1.5"
    destChainId,
    destTokenAddress,
    recipient,
  }) => {
    if (!signer) throw new Error('Wallet not connected');

    setStatus('bridging');
    const receiver = new ethers.Contract(CONTRACTS.taoReceiver, TAO_RECEIVER_ABI, signer);
    const tx = await receiver.depositTao(destChainId, destTokenAddress, recipient, {
      value: ethers.parseEther(taoAmount),
    });
    setTxHash(tx.hash);
    await tx.wait();
    setStatus('success');
    return tx.hash;
  }, [signer]);

  const reset = useCallback(() => { setStatus(null); setTxHash(null); }, []);

  return { status, txHash, bridgeToTao, bridgeFromTao, getBalance, reset };
}

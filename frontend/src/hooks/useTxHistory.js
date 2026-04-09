import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, TOKENS } from './useBridge';

// ── ABIs (events only) ───────────────────────────────────────────────────────
const VAULT_ABI = [
  'event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
];

const TAO_RECEIVER_ABI = [
  'event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
];

// ── Config ───────────────────────────────────────────────────────────────────
const BROWSER_RPCS = {
  1:    'https://cloudflare-eth.com',
  8453: 'https://mainnet.base.org',
  56:   'https://bsc.publicnode.com',
  964:  'https://lite.chain.opentensor.ai',
};

const SOURCE_CHAINS = [
  { chainId: 1,    name: 'Ethereum', lookback: 50_000  },
  { chainId: 8453, name: 'Base',     lookback: 200_000 }, // ~2s/block
  { chainId: 56,   name: 'BSC',      lookback: 100_000 }, // ~3s/block
];

const CHAIN_NAMES = { 1: 'Ethereum', 8453: 'Base', 56: 'BSC', 964: 'Bittensor' };

const CHAIN_EXPLORERS = {
  1:    'https://etherscan.io/tx/',
  8453: 'https://basescan.org/tx/',
  56:   'https://bscscan.com/tx/',
  964:  'https://evm.taostats.io/tx/',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTokenSymbol(chainId, tokenAddress) {
  const tokens = TOKENS[chainId];
  if (!tokens) return '?';
  const entry = Object.entries(tokens).find(
    ([, v]) => v.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  return entry ? entry[0] : '?';
}

function getTokenDecimals(chainId, tokenAddress) {
  const tokens = TOKENS[chainId];
  if (!tokens) return 6;
  const entry = Object.entries(tokens).find(
    ([, v]) => v.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  return entry ? entry[1].decimals : 6;
}

const _providers = {};
function getProvider(chainId) {
  if (!_providers[chainId])
    _providers[chainId] = new ethers.JsonRpcProvider(BROWSER_RPCS[chainId]);
  return _providers[chainId];
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTxHistory(address) {
  const [txs,     setTxs]     = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!address) { setTxs([]); return; }
    setLoading(true);
    const all = [];

    // 1. Deposit events on source chains (Stable → TAO)
    await Promise.allSettled(
      SOURCE_CHAINS.map(async ({ chainId, name, lookback }) => {
        const vaultAddress = CONTRACTS.vaults[chainId];
        if (!vaultAddress) return;
        try {
          const provider  = getProvider(chainId);
          const vault     = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
          const latest    = await provider.getBlockNumber();
          const fromBlock = Math.max(0, latest - lookback);
          const events    = await vault.queryFilter(
            vault.filters.Deposit(null, address),
            fromBlock,
            latest
          );
          for (const ev of events) {
            const { token, grossAmount, nonce } = ev.args;
            const symbol   = getTokenSymbol(chainId, token);
            const decimals = getTokenDecimals(chainId, token);
            all.push({
              id:          `dep-${chainId}-${ev.transactionHash}`,
              type:        'stable→tao',
              srcChainId:  chainId,
              srcChain:    name,
              destChain:   'Bittensor',
              token:       symbol,
              amount:      parseFloat(ethers.formatUnits(grossAmount, decimals)),
              blockNumber: ev.blockNumber,
              txHash:      ev.transactionHash,
              explorerUrl: CHAIN_EXPLORERS[chainId] + ev.transactionHash,
              nonce:       nonce.toString(),
            });
          }
        } catch (err) {
          console.warn(`[TxHistory] chain=${chainId}:`, err.message);
        }
      })
    );

    // 2. TaoDeposit events on Bittensor EVM (TAO → Stable) — current + old receiver
    const OLD_RECEIVER = '0x560F9e82e941C8dD8D6A8c75e06E4142210d6a84';
    const taoReceivers = [...new Set([CONTRACTS.taoReceiver, OLD_RECEIVER].filter(Boolean))];
    for (const receiverAddr of taoReceivers) {
      try {
        const provider  = getProvider(964);
        const receiver  = new ethers.Contract(receiverAddr, TAO_RECEIVER_ABI, provider);
        const latest    = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 200_000);
        const events    = await receiver.queryFilter(
          receiver.filters.TaoDeposit(address),
          fromBlock,
          latest
        );
        for (const ev of events) {
          const { destChainId, destToken, grossAmount, nonce } = ev.args;
          const destChainNum = Number(destChainId);
          const symbol       = getTokenSymbol(destChainNum, destToken);
          all.push({
            id:          `wd-${ev.transactionHash}`,
            type:        'tao→stable',
            srcChainId:  964,
            srcChain:    'Bittensor',
            destChain:   CHAIN_NAMES[destChainNum] || `Chain ${destChainNum}`,
            token:       symbol,
            amount:      parseFloat(ethers.formatEther(grossAmount)),
            blockNumber: ev.blockNumber,
            txHash:      ev.transactionHash,
            explorerUrl: CHAIN_EXPLORERS[964] + ev.transactionHash,
            nonce:       nonce.toString(),
          });
        }
      } catch (err) {
        console.warn('[TxHistory] bittensor:', err.message);
      }
    }

    all.sort((a, b) => b.blockNumber - a.blockNumber);
    setTxs(all);
    setLoading(false);
  }, [address]);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(fetchHistory, 30_000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  return { txs, loading, refresh: fetchHistory };
}

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const PASS_CONTRACT = import.meta.env.VITE_PASS_CONTRACT || '0x3abFa4d820878522Df211A884216242475183967';
const TAO_RPC       = import.meta.env.VITE_TAO_RPC       || 'https://lite.chain.opentensor.ai';

const ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

/**
 * Two-phase detection:
 * 1. balanceOf → resolves hasPass + balance count fast
 * 2. Transfer event scan → resolves all tokenIds owned by address
 */
export function useMyPass(address) {
  const [state, setState] = useState({ loading: true, hasPass: false, tokenIds: [], balance: 0 });

  useEffect(() => {
    if (!address || !PASS_CONTRACT) {
      setState({ loading: false, hasPass: false, tokenIds: [], balance: 0 });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const provider = new ethers.JsonRpcProvider(TAO_RPC);
        const contract = new ethers.Contract(PASS_CONTRACT, ABI, provider);

        // ── Phase 1: fast balanceOf ─────────────────────────────────────
        const balance = await contract.balanceOf(address);
        const hasPass = balance > 0n;
        const count   = Number(balance);

        if (!cancelled) setState({ loading: false, hasPass, tokenIds: [], balance: count });
        if (!hasPass) return;

        // ── Phase 2: find all tokenIds via Transfer events ──────────────
        const latest    = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 250_000);

        const events = await contract.queryFilter(
          contract.filters.Transfer(null, address),
          fromBlock,
          latest
        );

        // Collect unique tokenIds received by this address
        const candidates = [...new Map(
          events.map(ev => [ev.args.tokenId.toString(), ev.args.tokenId])
        ).values()];

        // Verify each is still owned (parallel)
        const owned = (await Promise.all(
          candidates.map(async (tid) => {
            try {
              const owner = await contract.ownerOf(tid);
              return owner.toLowerCase() === address.toLowerCase() ? tid.toString() : null;
            } catch { return null; }
          })
        )).filter(Boolean).sort((a, b) => Number(a) - Number(b));

        if (!cancelled) setState(s => ({ ...s, tokenIds: owned }));
      } catch {
        if (!cancelled) setState({ loading: false, hasPass: false, tokenIds: [], balance: 0 });
      }
    }

    setState(s => ({ ...s, loading: true }));
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [address]);

  return state;
}

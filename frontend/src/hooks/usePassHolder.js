import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const PASS_CONTRACT = import.meta.env.VITE_PASS_CONTRACT || '';
const TAO_RPC       = import.meta.env.VITE_TAO_RPC || 'https://lite.chain.opentensor.ai';

const ABI = ['function balanceOf(address owner) view returns (uint256)'];

/**
 * Returns true if `address` holds at least 1 TAOflow Pass on Bittensor EVM.
 * Polls every 30s. Safe to call with null address.
 */
export function usePassHolder(address) {
  const [hasPass, setHasPass] = useState(false);

  useEffect(() => {
    if (!address || !PASS_CONTRACT) { setHasPass(false); return; }

    let cancelled = false;

    async function check() {
      try {
        const provider  = new ethers.JsonRpcProvider(TAO_RPC);
        const contract  = new ethers.Contract(PASS_CONTRACT, ABI, provider);
        const balance   = await contract.balanceOf(address);
        if (!cancelled) setHasPass(balance > 0n);
      } catch {
        if (!cancelled) setHasPass(false);
      }
    }

    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [address]);

  return hasPass;
}

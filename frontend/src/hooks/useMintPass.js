import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const PASS_ABI = [
  'function phase() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function availableSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function canFreeMint(address) view returns (bool)',
  'function isEarlyAccess(address) view returns (bool)',
  'function earlyAccessEndsAt() view returns (uint256)',
  'function earlyAccessTimeLeft() view returns (uint256)',
  'function MINT_PRICE() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function whitelistMint(uint256 quantity, bytes32[] proof) payable',
  'function earlyAccessMint(uint256 quantity) payable',
  'function publicMint(uint256 quantity) payable',
  'function freeMint()',
];

const TAO_RPC = import.meta.env.VITE_TAO_RPC || 'https://lite.chain.opentensor.ai';

// Phase enum
export const PHASE = { CLOSED: 0, WHITELIST: 1, EARLY_ACCESS: 2, PUBLIC: 3 };
export const PHASE_LABEL = { 0: 'Closed', 1: 'Whitelist', 2: 'Early Access', 3: 'Public' };

export function useMintPass(address, signer) {
  const passAddress = import.meta.env.VITE_PASS_CONTRACT || '';

  const [phase,           setPhase]           = useState(null);
  const [totalSupply,     setTotalSupply]      = useState(null);
  const [availableSupply, setAvailableSupply]  = useState(null);
  const [userBalance,     setUserBalance]      = useState(null);
  const [canFreeMint,     setCanFreeMint]      = useState(false);
  const [isEarlyAccess,   setIsEarlyAccess]    = useState(false);
  const [mintPrice,       setMintPrice]        = useState(null);
  const [maxSupply,       setMaxSupply]        = useState(500);
  const [timeLeft,        setTimeLeft]         = useState(0);
  const [loading,         setLoading]          = useState(true);
  const [minting,         setMinting]          = useState(false);
  const [txHash,          setTxHash]           = useState(null);
  const [error,           setError]            = useState(null);

  const refresh = useCallback(async () => {
    if (!passAddress) { setLoading(false); return; }
    try {
      const provider = new ethers.JsonRpcProvider(TAO_RPC);
      const contract = new ethers.Contract(passAddress, PASS_ABI, provider);

      const calls = [
        contract.phase(),
        contract.totalSupply(),
        contract.availableSupply(),
        contract.MINT_PRICE(),
        contract.MAX_SUPPLY(),
        contract.earlyAccessTimeLeft(),
      ];
      if (address) {
        calls.push(contract.balanceOf(address));
        calls.push(contract.canFreeMint(address));
        calls.push(contract.isEarlyAccess(address));
      }

      const results = await Promise.all(calls);
      setPhase(Number(results[0]));
      setTotalSupply(Number(results[1]));
      setAvailableSupply(Number(results[2]));
      setMintPrice(results[3]);
      setMaxSupply(Number(results[4]));
      setTimeLeft(Number(results[5]));
      if (address) {
        setUserBalance(Number(results[6]));
        setCanFreeMint(results[7]);
        setIsEarlyAccess(results[8]);
      }
    } catch (e) {
      console.error('useMintPass fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [address, passAddress]);

  useEffect(() => { refresh(); }, [refresh]);

  // Load merkle proof for connected wallet
  const [proof, setProof] = useState(null);
  useEffect(() => {
    if (!address) { setProof(null); return; }
    fetch('/merkle.json')
      .then(r => r.json())
      .then(m => {
        const p = m?.proofs?.[address] || m?.proofs?.[address.toLowerCase()] || null;
        setProof(p);
      })
      .catch(() => setProof(null));
  }, [address]);

  const isWhitelisted = proof !== null;

  const mint = useCallback(async (quantity = 1) => {
    if (!signer || !passAddress) return;
    setMinting(true);
    setError(null);
    setTxHash(null);
    try {
      const contract = new ethers.Contract(passAddress, PASS_ABI, signer);
      const price    = mintPrice || ethers.parseEther('0.01');
      const value    = price * BigInt(quantity);
      let tx;

      if (canFreeMint && quantity === 1) {
        tx = await contract.freeMint();
      } else if (phase === PHASE.WHITELIST && isWhitelisted) {
        tx = await contract.whitelistMint(quantity, proof, { value });
      } else if (phase === PHASE.EARLY_ACCESS && isEarlyAccess) {
        tx = await contract.earlyAccessMint(quantity, { value });
      } else {
        tx = await contract.publicMint(quantity, { value });
      }

      setTxHash(tx.hash);
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e.reason || e.message || 'Transaction failed');
    } finally {
      setMinting(false);
    }
  }, [signer, passAddress, mintPrice, canFreeMint, phase, isWhitelisted, isEarlyAccess, proof, refresh]);

  return {
    passAddress,
    phase,
    totalSupply,
    availableSupply,
    userBalance,
    canFreeMint,
    isEarlyAccess,
    isWhitelisted,
    mintPrice,
    maxSupply,
    timeLeft,
    loading,
    minting,
    txHash,
    error,
    mint,
    refresh,
  };
}

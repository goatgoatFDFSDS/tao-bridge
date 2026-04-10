import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const ABI = [
  'function mint(uint256 quantity) payable',
  'function totalMinted() view returns (uint256)',
  'function availableSupply() view returns (uint256)',
  'function mintOpen() view returns (bool)',
  'function MINT_PRICE() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function MAX_PER_TX() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const TAO_RPC = import.meta.env.VITE_TAO_RPC || 'https://lite.chain.opentensor.ai';

export function useMintMilady(address, signer) {
  const contractAddress = import.meta.env.VITE_MILADY_CONTRACT || '';

  const [totalMinted,     setTotalMinted]     = useState(null);
  const [availableSupply, setAvailableSupply]  = useState(null);
  const [mintOpen,        setMintOpen]         = useState(false);
  const [mintPrice,       setMintPrice]        = useState(null);
  const [maxSupply,       setMaxSupply]        = useState(1111);
  const [maxPerTx,        setMaxPerTx]         = useState(10);
  const [userBalance,     setUserBalance]      = useState(null);
  const [loading,         setLoading]          = useState(true);
  const [minting,         setMinting]          = useState(false);
  const [txHash,          setTxHash]           = useState(null);
  const [error,           setError]            = useState(null);

  const refresh = useCallback(async () => {
    if (!contractAddress) { setLoading(false); return; }
    try {
      const provider = new ethers.JsonRpcProvider(TAO_RPC);
      const c = new ethers.Contract(contractAddress, ABI, provider);
      const calls = [
        c.totalMinted(),
        c.availableSupply(),
        c.mintOpen(),
        c.MINT_PRICE(),
        c.MAX_SUPPLY(),
        c.MAX_PER_TX(),
      ];
      if (address) calls.push(c.balanceOf(address));
      const r = await Promise.all(calls);
      setTotalMinted(Number(r[0]));
      setAvailableSupply(Number(r[1]));
      setMintOpen(r[2]);
      setMintPrice(r[3]);
      setMaxSupply(Number(r[4]));
      setMaxPerTx(Number(r[5]));
      if (address) setUserBalance(Number(r[6]));
    } catch (e) {
      console.error('useMintMilady fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [address, contractAddress]);

  useEffect(() => { refresh(); }, [refresh]);

  const mint = useCallback(async (quantity) => {
    if (!signer || !contractAddress) return;
    setMinting(true);
    setError(null);
    setTxHash(null);
    try {
      const c     = new ethers.Contract(contractAddress, ABI, signer);
      const price = mintPrice || ethers.parseEther('0.011');
      const value = price * BigInt(quantity);
      const tx    = await c.mint(quantity, { value });
      setTxHash(tx.hash);
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e.reason || e.shortMessage || e.message || 'Transaction failed');
    } finally {
      setMinting(false);
    }
  }, [signer, contractAddress, mintPrice, refresh]);

  return {
    contractAddress,
    totalMinted,
    availableSupply,
    mintOpen,
    mintPrice,
    maxSupply,
    maxPerTx,
    userBalance,
    loading,
    minting,
    txHash,
    error,
    mint,
    refresh,
  };
}

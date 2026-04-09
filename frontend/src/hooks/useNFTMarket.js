import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { DEX_CONTRACTS } from './useSwap';

// TAOflow Pass NFT
export const PASS_NFT = '0x3abFa4d820878522Df211A884216242475183967';

const MARKETPLACE_ABI = [
  'function listings(address nft, uint256 tokenId) external view returns (address seller, uint256 price, bool active)',
  'function getListing(address nft, uint256 tokenId) external view returns (address seller, uint256 price, bool active)',
  'function list(address nft, uint256 tokenId, uint256 price) external',
  'function buy(address nft, uint256 tokenId) external payable',
  'function delist(address nft, uint256 tokenId) external',
  'function feePercent() external view returns (uint256)',
  'event Listed(address indexed nft, uint256 indexed tokenId, address seller, uint256 price)',
  'event Sold(address indexed nft, uint256 indexed tokenId, address buyer, uint256 price)',
  'event Delisted(address indexed nft, uint256 indexed tokenId)',
];

const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function approve(address to, uint256 tokenId) external',
  'function balanceOf(address owner) external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const BITTENSOR_RPC  = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';
const LITE_RPC       = 'https://lite.chain.opentensor.ai';
const IPFS_GW = 'https://ipfs.io/ipfs/';

function resolveIPFS(uri) {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) return IPFS_GW + uri.slice(7);
  return uri;
}

async function fetchMetadata(tokenURI) {
  const url = resolveIPFS(tokenURI);
  if (!url) return null;
  try {
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return null;
    const meta = await res.json().catch(() => null);
    if (meta?.image) meta.image = resolveIPFS(meta.image);
    return meta;
  } catch { return null; }
}

export { MARKETPLACE_ABI, ERC721_ABI };

export function useNFTMarket(address) {
  const [listings,    setListings]    = useState([]);
  const [myTokens,    setMyTokens]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [txLoading,   setTxLoading]   = useState(false);
  const [error,       setError]       = useState(null);
  const [txHash,      setTxHash]      = useState(null);

  // Fetch active listings by scanning Listed events
  const fetchListings = useCallback(async (nftAddress = PASS_NFT) => {
    setLoading(true);
    setError(null);
    try {
      const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
      const market = new ethers.Contract(DEX_CONTRACTS.NFTMarketplace, MARKETPLACE_ABI, provider);

      // Marketplace was just deployed — scan only last 5000 blocks to avoid RPC timeout
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 5000);
      const listedFilter = market.filters.Listed(nftAddress);
      const events = await market.queryFilter(listedFilter, fromBlock, 'latest');

      const active = [];
      for (const ev of events) {
        const tokenId = ev.args.tokenId;
        try {
          const [seller, price, isActive] = await market.getListing(nftAddress, tokenId);
          if (!isActive) continue;

          let tokenURI = '';
          let metadata = null;
          try {
            const nft = new ethers.Contract(nftAddress, ERC721_ABI, provider);
            tokenURI = await nft.tokenURI(tokenId);
            metadata = await fetchMetadata(tokenURI);
          } catch {}

          active.push({
            nft: nftAddress,
            tokenId: tokenId.toString(),
            seller,
            price,
            tokenURI,
            metadata,
            image: metadata?.image || null,
            name: metadata?.name || `#${tokenId}`,
          });
        } catch {}
      }
      setListings(active);
    } catch (e) {
      setError(e?.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tokens owned by current user
  const fetchMyTokens = useCallback(async (nftAddress = PASS_NFT) => {
    if (!address) { setMyTokens([]); return; }
    try {
      const provider = new ethers.JsonRpcProvider(LITE_RPC);
      const nft = new ethers.Contract(nftAddress, ERC721_ABI, provider);

      // Phase 1: balanceOf — if throws, skip early-exit (don't treat error as 0)
      let balance = 0n;
      try { balance = await nft.balanceOf(address); } catch {}
      if (balance === 0n) { setMyTokens([]); return; }

      // Phase 2: Transfer event scan — try last 250k blocks first
      const latest    = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - 250_000);
      const events    = await nft.queryFilter(
        nft.filters.Transfer(null, address), fromBlock, latest
      ).catch(() => []);

      let candidates = [...new Map(
        events.map(ev => [ev.args.tokenId.toString(), ev.args.tokenId])
      ).values()];

      // Fallback: if event scan found nothing but balance > 0 (NFT minted long ago),
      // brute-force ownerOf across full collection
      if (candidates.length === 0 && balance > 0n) {
        const total = Number(await nft.totalSupply().catch(() => 500n));
        const allIds = Array.from({ length: total }, (_, i) => BigInt(i));
        // Check in batches of 50 to avoid flooding RPC
        for (let i = 0; i < allIds.length; i += 50) {
          const batch = allIds.slice(i, i + 50);
          const results = await Promise.all(
            batch.map(async (tid) => {
              try {
                const owner = await nft.ownerOf(tid);
                return owner.toLowerCase() === address.toLowerCase() ? tid : null;
              } catch { return null; }
            })
          );
          candidates.push(...results.filter(Boolean));
          if (candidates.length >= Number(balance)) break;
        }
      }

      // Verify still owned (for event-scan candidates)
      const ownedIds = (await Promise.all(
        candidates.map(async (tid) => {
          try {
            const owner = await nft.ownerOf(tid);
            return owner.toLowerCase() === address.toLowerCase() ? tid.toString() : null;
          } catch { return null; }
        })
      )).filter(Boolean).sort((a, b) => Number(a) - Number(b));

      // Fetch metadata for each
      const tokens = await Promise.all(ownedIds.map(async (tokenId) => {
        let tokenURI = '';
        let metadata = null;
        try {
          tokenURI = await nft.tokenURI(tokenId);
          metadata = await fetchMetadata(tokenURI);
        } catch {}
        return {
          tokenId,
          tokenURI,
          metadata,
          image: metadata?.image || null,
          name: metadata?.name || `TAOflow Pass #${tokenId}`,
        };
      }));

      setMyTokens(tokens);
    } catch {}
  }, [address]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    fetchMyTokens();
  }, [fetchMyTokens]);

  // List an NFT
  const listNFT = useCallback(async (signer, nftAddress, tokenId, priceWei) => {
    setTxLoading(true);
    setTxHash(null);
    setError(null);
    try {
      const nft = new ethers.Contract(nftAddress, ERC721_ABI, signer);
      const market = new ethers.Contract(DEX_CONTRACTS.NFTMarketplace, MARKETPLACE_ABI, signer);
      // Approve marketplace
      const approved = await nft.getApproved(tokenId);
      const isApprovedAll = await nft.isApprovedForAll(await signer.getAddress(), DEX_CONTRACTS.NFTMarketplace);
      if (!isApprovedAll && approved.toLowerCase() !== DEX_CONTRACTS.NFTMarketplace.toLowerCase()) {
        const appTx = await nft.approve(DEX_CONTRACTS.NFTMarketplace, tokenId);
        await appTx.wait();
      }
      const tx = await market.list(nftAddress, tokenId, priceWei);
      setTxHash(tx.hash);
      await tx.wait();
      await fetchListings(nftAddress);
      await fetchMyTokens(nftAddress);
    } catch (e) {
      setError(e?.shortMessage || e?.message || 'List failed');
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [fetchListings, fetchMyTokens]);

  // Buy an NFT
  const buyNFT = useCallback(async (signer, nftAddress, tokenId, price) => {
    setTxLoading(true);
    setTxHash(null);
    setError(null);
    try {
      const market = new ethers.Contract(DEX_CONTRACTS.NFTMarketplace, MARKETPLACE_ABI, signer);
      const tx = await market.buy(nftAddress, tokenId, { value: price });
      setTxHash(tx.hash);
      await tx.wait();
      await fetchListings(nftAddress);
    } catch (e) {
      setError(e?.shortMessage || e?.message || 'Buy failed');
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [fetchListings]);

  // Delist an NFT
  const delistNFT = useCallback(async (signer, nftAddress, tokenId) => {
    setTxLoading(true);
    setTxHash(null);
    setError(null);
    try {
      const market = new ethers.Contract(DEX_CONTRACTS.NFTMarketplace, MARKETPLACE_ABI, signer);
      const tx = await market.delist(nftAddress, tokenId);
      setTxHash(tx.hash);
      await tx.wait();
      await fetchListings(nftAddress);
      await fetchMyTokens(nftAddress);
    } catch (e) {
      setError(e?.shortMessage || e?.message || 'Delist failed');
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [fetchListings, fetchMyTokens]);

  return {
    listings, myTokens, loading, txLoading, error, txHash,
    fetchListings, fetchMyTokens,
    listNFT, buyNFT, delistNFT,
    MARKETPLACE_ADDRESS: DEX_CONTRACTS.NFTMarketplace,
    PASS_NFT,
  };
}

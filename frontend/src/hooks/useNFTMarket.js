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
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
];

const BITTENSOR_RPC = 'https://lite.chain.opentensor.ai';

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

      // Scan for Listed events from beginning (or last 10000 blocks)
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);
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
            // Try to fetch metadata if it's an http/https URL
            if (tokenURI.startsWith('http')) {
              const res = await fetch(tokenURI).catch(() => null);
              if (res?.ok) metadata = await res.json().catch(() => null);
            } else if (tokenURI.startsWith('data:application/json')) {
              const json = tokenURI.replace('data:application/json;base64,', '');
              metadata = JSON.parse(atob(json));
            }
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

  // Fetch tokens owned by current user (for Pass NFT)
  const fetchMyTokens = useCallback(async (nftAddress = PASS_NFT) => {
    if (!address) { setMyTokens([]); return; }
    try {
      const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
      const nft = new ethers.Contract(nftAddress, ERC721_ABI, provider);
      const balance = Number(await nft.balanceOf(address).catch(() => 0n));
      const tokens = [];
      for (let i = 0; i < balance; i++) {
        try {
          const tokenId = await nft.tokenOfOwnerByIndex(address, i);
          let tokenURI = '';
          let metadata = null;
          try {
            tokenURI = await nft.tokenURI(tokenId);
            if (tokenURI.startsWith('http')) {
              const res = await fetch(tokenURI).catch(() => null);
              if (res?.ok) metadata = await res.json().catch(() => null);
            } else if (tokenURI.startsWith('data:application/json')) {
              const json = tokenURI.replace('data:application/json;base64,', '');
              metadata = JSON.parse(atob(json));
            }
          } catch {}
          tokens.push({
            tokenId: tokenId.toString(),
            tokenURI,
            metadata,
            image: metadata?.image || null,
            name: metadata?.name || `#${tokenId}`,
          });
        } catch {}
      }
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

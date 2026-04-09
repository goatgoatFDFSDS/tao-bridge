import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useNFTMarket, PASS_NFT } from '../hooks/useNFTMarket';
import { DEX_CONTRACTS } from '../hooks/useSwap';

const BITTENSOR_RPC = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';

// Known collections on Bittensor EVM
const COLLECTIONS = [
  {
    name: 'TAOflow Pass',
    address: PASS_NFT,
    description: 'The official TAOflow Pass NFT. Holders get 0% bridge fees, trading bot access, reward boosts and full ecosystem access.',
    image: '/nft.png',
    supply: 500,
    chain: 'Bittensor EVM (964)',
    standard: 'ERC-721A',
  },
];

function NFTCard({ item, address, signer, onBuy, buying }) {
  const [imgError, setImgError] = useState(false);
  const isMine = address && item.seller.toLowerCase() === address.toLowerCase();

  return (
    <div className="nft-card">
      <div className="nft-card-img">
        {item.image && !imgError ? (
          <img src={item.image} alt={item.name} onError={() => setImgError(true)}
            style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius-sm)' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-hover)', borderRadius:'var(--radius-sm)', fontSize:'2.5rem' }}>
            τ
          </div>
        )}
      </div>
      <div className="nft-card-body">
        <div className="nft-card-name">{item.name}</div>
        <div className="nft-card-id">Token #{item.tokenId}</div>
        <div className="nft-card-price">
          <svg width="13" height="13" viewBox="0 0 20 20" style={{ marginRight:4 }}>
            <circle cx="10" cy="10" r="10" fill="#00d4aa" opacity="0.7" />
            <text x="10" y="14.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="800" fontFamily="Inter">τ</text>
          </svg>
          {ethers.formatEther(item.price)} TAO
        </div>
        {isMine && <div style={{ fontSize:'0.72rem', color:'var(--cyan)', marginBottom:4 }}>Your listing</div>}
        <button
          className="btn-bridge"
          style={{ padding:'9px 0', width:'100%', marginTop:6, fontSize:'0.82rem' }}
          disabled={buying || !signer || isMine}
          onClick={() => onBuy(item)}>
          {isMine ? 'Your listing' : buying ? <><div className="spinner" style={{ width:12, height:12, borderWidth:2 }} />Buying...</> : 'Buy Now'}
        </button>
      </div>
    </div>
  );
}

function MyNFTCard({ item, signer, address, onList, listing, marketAddress }) {
  const [price, setPrice]   = useState('');
  const [show,  setShow]    = useState(false);

  return (
    <div className="nft-card" style={{ border:'1px solid rgba(0,212,170,0.2)' }}>
      <div className="nft-card-img">
        {item.image ? (
          <img src={item.image} alt={item.name}
            style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius-sm)' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-hover)', borderRadius:'var(--radius-sm)', fontSize:'2.5rem' }}>τ</div>
        )}
      </div>
      <div className="nft-card-body">
        <div className="nft-card-name">{item.name}</div>
        <div className="nft-card-id">Token #{item.tokenId}</div>
        <button className="dir-tab" style={{ width:'100%', padding:'7px 0', marginTop:8, fontSize:'0.82rem' }}
          onClick={() => setShow(s => !s)}>
          {show ? 'Cancel' : 'List for Sale'}
        </button>
        {show && (
          <div style={{ marginTop:10 }}>
            <input className="amount-input" style={{ width:'100%', marginBottom:8 }}
              type="number" placeholder="Price in TAO"
              value={price} onChange={e => setPrice(e.target.value)} />
            <button className="btn-bridge" style={{ width:'100%', padding:'8px 0', fontSize:'0.82rem' }}
              disabled={listing || !price || parseFloat(price) <= 0}
              onClick={() => onList(item.tokenId, price)}>
              {listing ? <><div className="spinner" style={{ width:12, height:12, borderWidth:2 }} />Listing...</> : 'Confirm List'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NFTMarket({ address, signer, chainId, connect, switchChain }) {
  const {
    listings, myTokens, loading, txLoading, error, txHash,
    fetchListings, fetchMyTokens,
    listNFT, buyNFT, delistNFT,
    MARKETPLACE_ADDRESS,
  } = useNFTMarket(address);

  const [activeCollection, setActiveCollection] = useState(PASS_NFT);
  const [activeTab, setActiveTab]               = useState('listings');
  const [buyingId, setBuyingId]                 = useState(null);
  const [listingId, setListingId]               = useState(null);
  const [toast, setToast]                       = useState(null);
  const [stats, setStats]                       = useState({ sales: 0, volume: 0, topSale: 0 });

  // Fetch sales stats from Sold events
  useEffect(() => {
    async function loadStats() {
      try {
        const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
        const MARKETPLACE_ABI = [
          'event Sold(address indexed nft, uint256 indexed tokenId, address buyer, uint256 price)',
        ];
        const market = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);
        const latest = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 5000);
        const events = await market.queryFilter(
          market.filters.Sold(activeCollection), fromBlock, 'latest'
        ).catch(() => []);
        let volume = 0n, topSale = 0n;
        for (const ev of events) {
          volume += ev.args.price;
          if (ev.args.price > topSale) topSale = ev.args.price;
        }
        setStats({
          sales: events.length,
          volume: parseFloat(ethers.formatEther(volume)),
          topSale: parseFloat(ethers.formatEther(topSale)),
        });
      } catch {}
    }
    loadStats();
  }, [activeCollection, MARKETPLACE_ADDRESS, listings]);

  const isOnBittensor = chainId === 964;

  useEffect(() => {
    fetchListings(activeCollection);
  }, [activeCollection, fetchListings]);

  useEffect(() => {
    if (address) fetchMyTokens(activeCollection);
  }, [address, activeCollection, fetchMyTokens]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleBuy = async (item) => {
    if (!address) { connect(); return; }
    if (!isOnBittensor) { switchChain(964); return; }
    setBuyingId(item.tokenId);
    try {
      await buyNFT(signer, item.nft, item.tokenId, item.price);
      setToast({ msg: `Bought ${item.name} successfully!`, type: 'success' });
    } catch (e) {
      setToast({ msg: e?.shortMessage || e?.message || 'Buy failed', type: 'error' });
    }
    setBuyingId(null);
  };

  const handleList = async (tokenId, priceStr) => {
    if (!address) { connect(); return; }
    if (!isOnBittensor) { switchChain(964); return; }
    setListingId(tokenId);
    try {
      const priceWei = ethers.parseEther(priceStr);
      await listNFT(signer, activeCollection, tokenId, priceWei);
      setToast({ msg: 'NFT listed successfully!', type: 'success' });
    } catch (e) {
      setToast({ msg: e?.shortMessage || e?.message || 'List failed', type: 'error' });
    }
    setListingId(null);
  };

  const handleDelist = async (tokenId) => {
    if (!address || !signer) return;
    setBuyingId(tokenId);
    try {
      await delistNFT(signer, activeCollection, tokenId);
      setToast({ msg: 'NFT delisted.', type: 'success' });
    } catch (e) {
      setToast({ msg: e?.shortMessage || e?.message || 'Delist failed', type: 'error' });
    }
    setBuyingId(null);
  };

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1 className="page-title">NFT Marketplace</h1>
        <p className="page-sub">Buy and sell NFTs on Bittensor EVM with native TAO</p>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`} onClick={() => setToast(null)}
          style={{ position:'fixed', top:80, right:24, zIndex:9999 }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 20px' }}>

        {/* Collection header banner */}
        {(() => {
          const col = COLLECTIONS.find(c => c.address === activeCollection);
          if (!col) return null;
          return (
            <div className="bridge-card" style={{ padding:0, marginBottom:20, overflow:'hidden' }}>
              {/* Banner gradient */}
              <div style={{ height:100, background:'linear-gradient(135deg, #0d1f3c 0%, #0a2540 40%, #061a2e 100%)', position:'relative' }}>
                <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 60% 50%, rgba(59,130,246,0.18) 0%, transparent 70%)' }} />
              </div>
              {/* Collection info */}
              <div style={{ padding:'0 20px 18px', position:'relative' }}>
                {/* NFT image floating over banner */}
                <div style={{ position:'relative', marginTop:-40, marginBottom:10, display:'inline-block' }}>
                  <img src={col.image} alt={col.name}
                    style={{ width:80, height:80, borderRadius:12, border:'3px solid var(--bg-card)', objectFit:'cover', display:'block', background:'var(--bg-hover)' }}
                    onError={e => { e.target.style.display='none'; }} />
                </div>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:4 }}>{col.name}</div>
                    <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', maxWidth:480, lineHeight:1.5 }}>{col.description}</div>
                    <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
                      <div><span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Supply </span><span style={{ fontSize:'0.82rem', fontWeight:600 }}>{col.supply}</span></div>
                      <div><span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Chain </span><span style={{ fontSize:'0.82rem', fontWeight:600 }}>{col.chain}</span></div>
                      <div><span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Standard </span><span style={{ fontSize:'0.82rem', fontWeight:600 }}>{col.standard}</span></div>
                      <div>
                        <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Contract </span>
                        <a href={`https://evm.taostats.io/address/${activeCollection}`} target="_blank" rel="noreferrer"
                          style={{ fontSize:'0.82rem', color:'var(--cyan)', textDecoration:'none', fontFamily:'monospace' }}>
                          {activeCollection.slice(0,8)}...{activeCollection.slice(-6)} ↗
                        </a>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Marketplace fee <span style={{ color:'var(--cyan)', fontWeight:600 }}>2.5%</span></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Collection selector (if more than 1 collection) */}
        {COLLECTIONS.length > 1 && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <span style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>Collection:</span>
            {COLLECTIONS.map(c => (
              <button key={c.address}
                className={`dir-tab ${activeCollection === c.address ? 'active' : ''}`}
                style={{ padding:'8px 14px', fontSize:'0.84rem' }}
                onClick={() => setActiveCollection(c.address)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Stats bar */}
        {(() => {
          const col = COLLECTIONS.find(c => c.address === activeCollection);
          const floor = listings.length > 0
            ? Math.min(...listings.map(l => parseFloat(ethers.formatEther(l.price))))
            : 0;
          const mktCap = col ? floor * col.supply : 0;
          const statItems = [
            { label: 'Listed',    value: listings.length },
            { label: 'Floor',     value: floor > 0 ? `${floor} TAO` : '—' },
            { label: 'Sales',     value: stats.sales },
            { label: 'Volume',    value: stats.volume > 0 ? `${stats.volume.toFixed(1)} TAO` : '—' },
            { label: 'Top Sale',  value: stats.topSale > 0 ? `${stats.topSale} TAO` : '—' },
            { label: 'Mkt Cap',   value: mktCap > 0 ? `${mktCap.toFixed(0)} TAO` : '—' },
            { label: 'Fee',       value: '2.5%' },
          ];
          return (
            <div className="bridge-card" style={{ padding:'12px 20px', marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'nowrap' }}>
                {statItems.map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontSize:'0.9rem', fontWeight:600, color:'var(--text)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Tabs + refresh */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <button className={`dir-tab ${activeTab === 'listings' ? 'active' : ''}`}
            style={{ padding:'7px 14px', fontSize:'0.82rem' }}
            onClick={() => setActiveTab('listings')}>
            Listings ({listings.length})
          </button>
          {address && (
            <button className={`dir-tab ${activeTab === 'mine' ? 'active' : ''}`}
              style={{ padding:'7px 14px', fontSize:'0.82rem' }}
              onClick={() => setActiveTab('mine')}>
              My NFTs ({myTokens.length})
            </button>
          )}
          <button className="dir-tab" style={{ padding:'7px 14px', fontSize:'0.82rem' }}
            onClick={() => { fetchListings(activeCollection); fetchMyTokens(activeCollection); }}>
            Refresh
          </button>
        </div>

        {/* tx hash */}
        {txHash && (
          <div style={{ marginBottom:14, textAlign:'center' }}>
            <a className="tx-link" href={`https://evm.taostats.io/tx/${txHash}`} target="_blank" rel="noreferrer">
              {txHash.slice(0,10)}...{txHash.slice(-6)} ↗
            </a>
          </div>
        )}

        {error && (
          <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'var(--radius-sm)', padding:'12px 16px', color:'var(--red)', marginBottom:16 }}>
            {error}
          </div>
        )}

        {/* Listings tab */}
        {activeTab === 'listings' && (
          <>
            {loading && (
              <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
                <div className="spinner" style={{ margin:'0 auto 12px', borderColor:'rgba(0,212,170,0.2)', borderTopColor:'#00d4aa' }} />
                Loading listings...
              </div>
            )}
            {!loading && listings.length === 0 && (
              <div className="bridge-card" style={{ textAlign:'center', padding:'48px 24px' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🖼️</div>
                <div style={{ fontWeight:600, marginBottom:6 }}>No active listings</div>
                <div style={{ color:'var(--text-muted)', fontSize:'0.88rem' }}>
                  {address ? 'List your NFTs using the "My NFTs" tab.' : 'Connect your wallet to list NFTs for sale.'}
                </div>
                {!address && (
                  <button className="btn-connect" style={{ marginTop:16 }} onClick={connect}>
                    Connect Wallet
                  </button>
                )}
              </div>
            )}
            {!loading && listings.length > 0 && (
              <div className="nft-grid">
                {listings.map(item => (
                  <NFTCard key={`${item.nft}-${item.tokenId}`}
                    item={item} address={address} signer={signer}
                    onBuy={handleBuy}
                    buying={buyingId === item.tokenId} />
                ))}
              </div>
            )}
          </>
        )}

        {/* My NFTs tab */}
        {activeTab === 'mine' && address && (
          <>
            {myTokens.length === 0 && (
              <div className="bridge-card" style={{ textAlign:'center', padding:'48px 24px' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>👛</div>
                <div style={{ fontWeight:600, marginBottom:6 }}>No NFTs in your wallet</div>
                <div style={{ color:'var(--text-muted)', fontSize:'0.88rem' }}>
                  You don't hold any {COLLECTIONS.find(c => c.address === activeCollection)?.name} NFTs.
                </div>
              </div>
            )}
            {myTokens.length > 0 && (
              <div className="nft-grid">
                {myTokens.map(item => (
                  <MyNFTCard key={item.tokenId} item={item} signer={signer} address={address}
                    onList={handleList} listing={listingId === item.tokenId}
                    marketAddress={MARKETPLACE_ADDRESS} />
                ))}
              </div>
            )}

            {/* Active listings by me */}
            {listings.filter(l => address && l.seller.toLowerCase() === address.toLowerCase()).length > 0 && (
              <>
                <div style={{ fontWeight:600, marginTop:24, marginBottom:12 }}>Your Active Listings</div>
                <div className="nft-grid">
                  {listings
                    .filter(l => address && l.seller.toLowerCase() === address.toLowerCase())
                    .map(item => (
                      <div key={`${item.nft}-${item.tokenId}`} className="nft-card" style={{ border:'1px solid rgba(248,113,113,0.25)' }}>
                        <div className="nft-card-img">
                          {item.image ? (
                            <img src={item.image} alt={item.name}
                              style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius-sm)' }} />
                          ) : (
                            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-hover)', borderRadius:'var(--radius-sm)', fontSize:'2.5rem' }}>τ</div>
                          )}
                        </div>
                        <div className="nft-card-body">
                          <div className="nft-card-name">{item.name}</div>
                          <div className="nft-card-price">{ethers.formatEther(item.price)} TAO</div>
                          <div style={{ fontSize:'0.72rem', color:'var(--cyan)', marginBottom:6 }}>Active listing</div>
                          <button className="btn-bridge"
                            style={{ padding:'8px 0', width:'100%', fontSize:'0.82rem', background:'linear-gradient(90deg, #f87171, #ef4444)' }}
                            disabled={buyingId === item.tokenId || txLoading}
                            onClick={() => handleDelist(item.tokenId)}>
                            {buyingId === item.tokenId ? <><div className="spinner" style={{ width:12, height:12, borderWidth:2 }} />Delisting...</> : 'Delist'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

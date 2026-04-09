import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet, CHAINS } from './hooks/useWallet';
import { useBridge, CONTRACTS, TOKENS } from './hooks/useBridge';
import { useTaoPrice } from './hooks/useTaoPrice';
import { useTxHistory } from './hooks/useTxHistory';
import DocsModal from './components/DocsModal';
import TxHistory from './components/TxHistory';
import MintPass from './components/MintPass';
import MyPass from './components/MyPass';
import { usePassHolder } from './hooks/usePassHolder';
import Swap from './components/Swap';
import Pools from './components/Pools';
import NFTMarket from './components/NFTMarket';
import WalletModal from './components/WalletModal';

// ─── Chain metadata ────────────────────────────────────────────────────────
const CHAIN_META = {
  1:    { name: 'Ethereum', color: '#627eea', explorer: 'https://etherscan.io/tx/' },
  8453: { name: 'Base',     color: '#0052ff', explorer: 'https://basescan.org/tx/' },
  56:   { name: 'BSC',      color: '#f0b90b', explorer: 'https://bscscan.com/tx/'  },
  964:  { name: 'Bittensor EVM', color: '#00d4aa', explorer: 'https://evm.taostats.io/tx/' },
};

const SOURCE_CHAINS = [1, 8453, 56];

// ─── SVG components ────────────────────────────────────────────────────────
function Logo() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
      <defs>
        <linearGradient id="logg" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%"   stopColor="#3b82f6" />
          <stop offset="55%"  stopColor="#00d4aa" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <path d="M6 19 C6 12, 12 7, 19 19 C26 31, 32 26, 32 19"
        stroke="url(#logg)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="6"  cy="19" r="3.5" fill="#3b82f6" />
      <circle cx="32" cy="19" r="3.5" fill="#4ade80" />
    </svg>
  );
}

function ChainIcon({ chainId, size = 22 }) {
  const colors = { 1: '#627eea', 8453: '#0052ff', 56: '#f0b90b', 964: '#00d4aa' };
  const labels = { 1: 'E', 8453: 'B', 56: 'B', 964: 'τ' };
  return (
    <svg width={size} height={size} viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="11" fill={colors[chainId] || '#3b82f6'} opacity="0.18" />
      <circle cx="11" cy="11" r="10" fill="none" stroke={colors[chainId] || '#3b82f6'} strokeWidth="1.2" />
      <text x="11" y="15.5" textAnchor="middle" fill={colors[chainId] || '#fff'}
        fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif">
        {labels[chainId] || '?'}
      </text>
    </svg>
  );
}

function TaoIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <defs>
        <linearGradient id="taog" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d4aa" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="10" fill="url(#taog)" />
      <text x="10" y="14.5" textAnchor="middle" fill="white"
        fontSize="9" fontWeight="800" fontFamily="Inter,sans-serif">τ</text>
    </svg>
  );
}

function TokenIcon({ symbol, size = 20 }) {
  if (symbol === 'TAO') return <TaoIcon size={size} />;
  const colors = { USDC: '#2775ca', USDT: '#26a17b' };
  const color = colors[symbol] || '#5b7aa8';
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="10" fill={color} />
      <text x="10" y="14" textAnchor="middle" fill="white"
        fontSize="7" fontWeight="700" fontFamily="Inter,sans-serif">
        {symbol?.slice(0, 2)}
      </text>
    </svg>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`toast ${type}`} onClick={onClose}>
      <span>{type === 'success' ? '✓' : type === 'error' ? '✕' : 'i'}</span>
      <span>{msg}</span>
    </div>
  );
}

// ─── TAO Price ticker ──────────────────────────────────────────────────────
function TaoPriceBadge({ price, change24h }) {
  if (!price) return null;
  const up = change24h >= 0;
  return (
    <div className="tao-price-badge">
      <TaoIcon size={16} />
      <span className="tao-price-value">${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span className={`tao-price-change ${up ? 'up' : 'down'}`}>
        {up ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
      </span>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const { address, chainId, signer, connect, connectWC, disconnect, switchChain, hasWC } = useWallet();
  const { status, txHash, bridgeToTao, bridgeFromTao, getBalance, reset } = useBridge(signer);
  const { price: taoPrice, change24h } = useTaoPrice();
  const { txs, loading: histLoading, refresh: refreshHistory } = useTxHistory(address);
  const hasPass = usePassHolder(address);

  const [page, setPage] = useState(() => {
    const p = window.location.pathname;
    if (p === '/mypass') return 'mypass';
    if (p === '/swap')   return 'swap';
    if (p === '/pools')  return 'pools';
    if (p === '/nfts')   return 'nfts';
    return 'bridge';
  });
  const [showDocs,        setShowDocs]        = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [tradeOpen,       setTradeOpen]       = useState(false);

  const TRADE_PAGES = ['swap', 'pools'];
  const isTradeActive = TRADE_PAGES.includes(page);
  const [direction,    setDirection]    = useState('to');     // 'to' | 'from'
  const [srcChainId,   setSrcChainId]   = useState(8453);
  const [tokenSymbol,  setTokenSymbol]  = useState('USDC');
  const [amount,       setAmount]       = useState('');
  const [recipient,    setRecipient]    = useState('');
  const [stableBalance, setStableBalance] = useState('0');
  const [taoBalance,   setTaoBalance]   = useState('0');
  const [toast,        setToast]        = useState(null);

  const isBridgingTo = direction === 'to';

  // Expected connected chain
  const expectedChain = isBridgingTo ? srcChainId : 964;
  const isWrongChain  = !!address && chainId !== expectedChain;

  // TAO you receive (when bridging → Bittensor)
  const taoOut = (taoPrice && amount && parseFloat(amount) > 0)
    ? (parseFloat(amount) / taoPrice).toFixed(6)
    : '0.000000';

  // USDC/USDT you receive (when bridging ← from Bittensor)
  const stableOut = (taoPrice && amount && parseFloat(amount) > 0)
    ? (parseFloat(amount) * taoPrice).toFixed(2)
    : '0.00';

  // Auto-fill recipient
  useEffect(() => { if (address) setRecipient(address); }, [address]);

  // Fetch stable balance (always from correct chain's RPC)
  useEffect(() => {
    if (!address) { setStableBalance('0'); return; }
    const token = TOKENS[srcChainId]?.[tokenSymbol];
    if (!token) { setStableBalance('0'); return; }
    getBalance(token.address, address, srcChainId).then(setStableBalance);
    const id = setInterval(() => {
      getBalance(token.address, address, srcChainId).then(setStableBalance);
    }, 15_000);
    return () => clearInterval(id);
  }, [address, srcChainId, tokenSymbol, getBalance]);

  // Fetch TAO balance on Bittensor EVM
  useEffect(() => {
    if (!address) { setTaoBalance('0'); return; }
    getBalance(null, address, 964).then(setTaoBalance);
    const id = setInterval(() => getBalance(null, address, 964).then(setTaoBalance), 15_000);
    return () => clearInterval(id);
  }, [address, getBalance]);

  const handleMax = () => {
    if (isBridgingTo) setAmount(parseFloat(stableBalance).toFixed(6));
    else setAmount(parseFloat(taoBalance).toFixed(6));
  };

  // ── Handle bridge ─────────────────────────────────────────────────────────
  const handleBridge = useCallback(async () => {
    if (!address) { setShowWalletModal(true); return; }
    if (isWrongChain) { switchChain(expectedChain); return; }
    if (!amount || parseFloat(amount) <= 0) return;
    if (!recipient) return;

    try {
      if (isBridgingTo) {
        const token        = TOKENS[srcChainId]?.[tokenSymbol];
        const vaultAddress = CONTRACTS.vaults[srcChainId];
        if (!token)        throw new Error(`${tokenSymbol} not supported on this chain`);
        if (!vaultAddress) throw new Error('Vault not deployed yet — fill .env');
        await bridgeToTao({
          tokenAddress:  token.address,
          tokenDecimals: token.decimals,
          amount,
          vaultAddress,
          recipient,
        });
      } else {
        const destToken = TOKENS[srcChainId]?.[tokenSymbol];
        if (!destToken) throw new Error(`${tokenSymbol} not supported on destination`);
        await bridgeFromTao({
          taoAmount:        amount,
          destChainId:      srcChainId,
          destTokenAddress: destToken.address,
          recipient,
        });
      }
      setToast({ msg: 'Transaction submitted! Funds arrive in ~1 min.', type: 'success' });
      setAmount('');
      setTimeout(refreshHistory, 5000);
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Transaction failed';
      setToast({ msg: msg.slice(0, 100), type: 'error' });
      reset();
    }
  }, [
    address, connect, isWrongChain, switchChain, expectedChain,
    amount, recipient, isBridgingTo, srcChainId, tokenSymbol,
    bridgeToTao, bridgeFromTao, reset, refreshHistory,
  ]);

  // ── Button label ──────────────────────────────────────────────────────────
  const btnLabel = () => {
    if (!address) return 'Connect Wallet';
    if (isWrongChain) return `Switch to ${CHAIN_META[expectedChain]?.name}`;
    if (status === 'approving') return <><div className="spinner" /> Approving...</>;
    if (status === 'bridging')  return <><div className="spinner" /> Bridging...</>;
    if (!amount || parseFloat(amount) <= 0) return 'Enter amount';
    if (isBridgingTo) return `Bridge to Bittensor EVM`;
    return `Bridge to ${CHAIN_META[srcChainId]?.name}`;
  };

  const btnDisabled = !!address && !isWrongChain && (
    status === 'approving' || status === 'bridging' ||
    !amount || parseFloat(amount) <= 0 || !recipient
  );

  const short = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : '';

  return (
    <div className="app">
      <div className="bg-canvas"><div className="wave" /></div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="header">
        <a className="logo" href="#">
          <Logo />
          <div className="logo-text"><span>TAO</span><span>flow</span></div>
        </a>

        <nav className="header-nav">
          {/* Trade dropdown */}
          <div style={{ position:'relative' }}
            onMouseEnter={() => setTradeOpen(true)}
            onMouseLeave={() => setTradeOpen(false)}>
            <button className={`nav-pill ${isTradeActive ? 'active' : ''}`}
              style={{ display:'flex', alignItems:'center', gap:5 }}>
              Trade
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity:0.6, transition:'transform .2s', transform: tradeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {tradeOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, zIndex:200, paddingTop:6 }}>
                <div style={{
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  borderRadius:10, padding:'6px', minWidth:130,
                  boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
                }}>
                  {[
                    { label:'Swap',  p:'swap',  url:'/swap' },
                    { label:'Pools', p:'pools', url:'/pools' },
                  ].map(({ label, p, url }) => (
                    <button key={p}
                      className={`nav-pill ${page === p ? 'active' : ''}`}
                      style={{ display:'block', width:'100%', textAlign:'left', borderRadius:7, marginBottom:2 }}
                      onClick={() => { setPage(p); window.history.pushState(null,'',url); setTradeOpen(false); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className={`nav-pill ${page === 'nfts' ? 'active' : ''}`}
            onClick={() => { setPage('nfts'); window.history.pushState(null,'','/nfts'); }}>
            Marketplace
          </button>

          <button className={`nav-pill ${page === 'mypass' ? 'active' : ''}`}
            onClick={() => { setPage('mypass'); window.history.pushState(null,'','/mypass'); }}
            style={{ display:'flex', alignItems:'center', gap:5 }}>
            My Pass
            {hasPass && <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--cyan)', boxShadow:'0 0 6px var(--cyan)', display:'inline-block' }} />}
          </button>

          {/* Separator */}
          <span style={{ width:1, height:18, background:'var(--border)', margin:'0 4px', display:'inline-block', alignSelf:'center' }} />

          <button className={`nav-pill ${page === 'bridge' ? 'active' : ''}`} onClick={() => { setPage('bridge'); window.history.pushState(null,'','/'); }}>Bridge</button>
          <button className="nav-pill" onClick={() => setShowDocs(true)}>Docs</button>
          <a className="nav-pill" href="https://t.me/TAOflowTradingBot" target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>Bot</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TaoPriceBadge price={taoPrice} change24h={change24h} />
          {address ? (
            <div className="wallet-connected">
              <div className="dot" />
              <span>{short(address)}</span>
              <button className="btn-disconnect" onClick={disconnect} title="Disconnect">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <button className="btn-connect" onClick={() => setShowWalletModal(true)}>Connect Wallet</button>
          )}
        </div>
      </header>

      {/* ── Swap page ────────────────────────────────────────────────────── */}
      {page === 'swap' && (
        <Swap
          address={address}
          signer={signer}
          chainId={chainId}
          connect={() => setShowWalletModal(true)}
          switchChain={switchChain}
        />
      )}

      {/* ── Pools page ───────────────────────────────────────────────────── */}
      {page === 'pools' && (
        <Pools
          address={address}
          signer={signer}
          chainId={chainId}
          connect={() => setShowWalletModal(true)}
          switchChain={switchChain}
        />
      )}

      {/* ── NFT Marketplace page ─────────────────────────────────────────── */}
      {page === 'nfts' && (
        <NFTMarket
          address={address}
          signer={signer}
          chainId={chainId}
          connect={() => setShowWalletModal(true)}
          switchChain={switchChain}
        />
      )}

      {/* ── My Pass page ─────────────────────────────────────────────────── */}
      {page === 'mypass' && (
        <MyPass
          address={address}
          txs={txs}
          taoPrice={taoPrice}
          connect={() => setShowWalletModal(true)}
        />
      )}

      {/* ── Pass (Mint) page ─────────────────────────────────────────────── */}
      {page === 'pass' && (
        <MintPass
          address={address}
          signer={signer}
          chainId={chainId}
          switchChain={switchChain}
          connect={connect}
        />
      )}

      {/* ── Bridge page ─────────────────────────────────────────────────── */}
      {page === 'bridge' && <>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="hero">
        <h1 className="hero-title">
          Bridge stables,<br /><span className="grad">receive TAO</span>
        </h1>
        <p className="hero-sub">
          Deposit USDC or USDT from Ethereum, Base or BSC and receive native TAO on Bittensor's EVM layer. Instant, bidirectional.
        </p>

        <div className="stats-row">
          {[
            { label: 'TAO price',       value: taoPrice ? `$${taoPrice.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}` : '...' },
            { label: 'Supported chains', value: '3' },
            { label: 'Tokens',           value: 'USDC · USDT' },
            { label: 'Avg. time',        value: '~1 min' },
          ].map(s => (
            <div className="stat-pill" key={s.label}>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="main">

        {/* Bridge card */}
        <div className="bridge-card">
          <div className="card-header">
            <span className="card-title">Bridge</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {taoPrice && (
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
                  1 TAO = <span style={{ color:'var(--cyan)', fontWeight:600 }}>${taoPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </span>
              )}
              <a
                href="https://evm.taostats.io"
                target="_blank"
                rel="noreferrer"
                className="card-settings"
                title="Block Explorer"
                style={{ textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Direction tabs */}
          <div className="direction-tabs">
            <button className={`dir-tab ${isBridgingTo ? 'active' : ''}`}
              onClick={() => { setDirection('to'); reset(); setAmount(''); }}>
              Stable → TAO
            </button>
            <button className={`dir-tab ${!isBridgingTo ? 'active' : ''}`}
              onClick={() => { setDirection('from'); reset(); setAmount(''); }}>
              TAO → Stable
            </button>
          </div>

          {/* Wrong network */}
          {isWrongChain && (
            <div className="network-warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Switch to <strong style={{marginLeft:4}}>{CHAIN_META[expectedChain]?.name}</strong>
            </div>
          )}

          {/* FROM */}
          <div className="section-label">
            {isBridgingTo ? 'From' : 'From Bittensor EVM'}
          </div>
          <div className="from-block">
            <div className="chain-token-row">
              {isBridgingTo ? (
                <select className="chain-select" value={srcChainId}
                  onChange={e => setSrcChainId(Number(e.target.value))}>
                  {SOURCE_CHAINS.map(cid => (
                    <option value={cid} key={cid}>{CHAIN_META[cid].name}</option>
                  ))}
                </select>
              ) : (
                <div className="chain-display">
                  <ChainIcon chainId={964} />
                  Bittensor EVM
                </div>
              )}

              {isBridgingTo ? (
                <select className="token-select" value={tokenSymbol}
                  onChange={e => setTokenSymbol(e.target.value)}>
                  {Object.keys(TOKENS[srcChainId] || {}).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <div className="chain-display" style={{ gap:6 }}>
                  <TaoIcon size={18} /> TAO
                </div>
              )}
            </div>

            <div className="amount-row">
              <input type="number" className="amount-input" placeholder="0.00"
                value={amount} min="0" onChange={e => setAmount(e.target.value)} />
            </div>

            <div className="balance-row">
              <span className="amount-usd">
                {isBridgingTo
                  ? `≈ $${parseFloat(amount || 0).toFixed(2)}`
                  : taoPrice
                    ? `≈ $${(parseFloat(amount || 0) * taoPrice).toFixed(2)}`
                    : ''}
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="balance-text">
                  Balance: {parseFloat(isBridgingTo ? stableBalance : taoBalance).toFixed(4)}{' '}
                  {isBridgingTo ? tokenSymbol : 'TAO'}
                </span>
                <button className="btn-max" onClick={handleMax}>MAX</button>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="arrow-wrap">
            <button className="arrow-btn"
              onClick={() => setDirection(d => d === 'to' ? 'from' : 'to')}
              title="Flip direction">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </button>
          </div>

          {/* TO */}
          <div className="section-label" style={{ marginTop:4 }}>
            {isBridgingTo ? 'To Bittensor EVM' : 'To'}
          </div>
          <div className="to-block">
            <div className="chain-token-row">
              {isBridgingTo ? (
                <div className="chain-display">
                  <ChainIcon chainId={964} />
                  Bittensor EVM
                </div>
              ) : (
                <select className="chain-select" value={srcChainId}
                  onChange={e => setSrcChainId(Number(e.target.value))}>
                  {SOURCE_CHAINS.map(cid => (
                    <option value={cid} key={cid}>{CHAIN_META[cid].name}</option>
                  ))}
                </select>
              )}

              {isBridgingTo ? (
                <div className="chain-display" style={{ gap:6 }}>
                  <TaoIcon size={18} /> TAO
                </div>
              ) : (
                <select className="token-select" value={tokenSymbol}
                  onChange={e => setTokenSymbol(e.target.value)}>
                  {Object.keys(TOKENS[srcChainId] || {}).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="amount-row">
              {isBridgingTo ? (
                <span className="receive-amount">{taoOut} <span style={{fontSize:'1rem',fontWeight:500}}>TAO</span></span>
              ) : (
                <span className="receive-amount">{stableOut} <span style={{fontSize:'1rem',fontWeight:500}}>{tokenSymbol}</span></span>
              )}
            </div>

            {taoPrice && amount && parseFloat(amount) > 0 && (
              <div className="balance-row">
                <span className="amount-usd">
                  {isBridgingTo
                    ? `≈ $${parseFloat(amount).toFixed(2)} at $${taoPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}/TAO`
                    : `≈ $${stableOut}`}
                </span>
              </div>
            )}
          </div>

          {/* Recipient */}
          <div className="recipient-wrap">
            <div className="section-label" style={{ marginTop:14 }}>Recipient address</div>
            <input type="text" className="recipient-input" placeholder="0x..."
              value={recipient} onChange={e => setRecipient(e.target.value)} />
          </div>

          {/* Pass holder badge */}
          {hasPass && (
            <div className="pass-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              TAOflow Pass — 0% bridge fee
            </div>
          )}

          {/* Info rows */}
          <div className="bridge-info">
            <div className="info-row">
              <span>Bridge fee</span>
              {hasPass ? (
                <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ textDecoration:'line-through', color:'var(--text-muted)', fontSize:'0.82rem' }}>
                    {isBridgingTo ? '1%' : '5%'}
                  </span>
                  <span className="green" style={{ fontWeight:700 }}>0% ✦</span>
                </span>
              ) : (
                <span>{isBridgingTo ? '1%' : '5%'}</span>
              )}
            </div>
            <div className="info-row">
              <span>Rate</span>
              <span>{taoPrice ? `1 TAO = $${taoPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '...'}</span>
            </div>
            <div className="info-row">
              <span>Estimated time</span>
              <span>1 to 5 minutes</span>
            </div>
            <div className="info-row">
              <span>You receive</span>
              <span>
                {isBridgingTo
                  ? `${taoOut} TAO`
                  : `${stableOut} ${tokenSymbol}`}
              </span>
            </div>
          </div>

          {/* TX link */}
          {txHash && (
            <div style={{ marginBottom:12, textAlign:'center' }}>
              <a className="tx-link"
                href={`${CHAIN_META[isBridgingTo ? srcChainId : 964]?.explorer}${txHash}`}
                target="_blank" rel="noreferrer">
                {short(txHash)} ↗
              </a>
            </div>
          )}

          {/* CTA */}
          <button
            className={`btn-bridge ${status === 'approving' || status === 'bridging' ? 'loading' : ''}`}
            onClick={handleBridge}
            disabled={btnDisabled}>
            {btnLabel()}
          </button>
        </div>

        {/* ── Side panel ─────────────────────────────────────────────────── */}
        <div className="info-panel">

          {/* TAO price card */}
          <div className="info-card" style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.06), rgba(59,130,246,0.06))' }}>
            <div className="info-card-title">
              <TaoIcon size={14} />
              TAO / USD
            </div>
            {taoPrice ? (
              <div>
                <div style={{ fontSize:'1.8rem', fontWeight:800, background:'var(--grad-text)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                  ${taoPrice.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
                </div>
                <div style={{ fontSize:'0.8rem', marginTop:4, color: change24h >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {change24h >= 0 ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}% (24h)
                </div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:6 }}>
                  via CoinGecko · updated 30s
                </div>
              </div>
            ) : (
              <div style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Loading...</div>
            )}
          </div>

          <div className="info-card">
            <div className="info-card-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              How it works
            </div>
            <div className="step-list">
              {[
                ['Approve', 'Allow the vault to spend your USDC/USDT'],
                ['Deposit', 'Tokens are locked in the vault contract'],
                ['Relay',   'Relayer detects deposit, fetches TAO price'],
                ['Receive', 'Native TAO sent to your Bittensor EVM wallet'],
              ].map(([t, d], i) => (
                <div className="step-item" key={i}>
                  <div className="step-num">{i + 1}</div>
                  <div className="step-text"><strong>{t}</strong> — {d}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Supported
            </div>
            <div className="chain-list">
              {[
                { id: 1,    tokens: 'USDC · USDT' },
                { id: 8453, tokens: 'USDC · USDT' },
                { id: 56,   tokens: 'USDC · USDT' },
                { id: 964,  tokens: 'Native TAO'  },
              ].map(c => (
                <div className="chain-item" key={c.id}>
                  <div className="chain-dot" style={{ background: CHAIN_META[c.id]?.color }} />
                  <span className="chain-item-name">{CHAIN_META[c.id]?.name}</span>
                  <span className="chain-item-tokens">{c.tokens}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <TxHistory txs={txs} loading={histLoading} address={address} refresh={refreshHistory} />

      </> /* end bridge page */}

      <footer className="footer">
        TAOflow · Bittensor EVM Bridge &nbsp;·&nbsp;
        <a href="https://evm.taostats.io" target="_blank" rel="noreferrer">Explorer</a>
        &nbsp;·&nbsp;
        <a href="https://docs.bittensor.com/evm-tutorials" target="_blank" rel="noreferrer">Docs</a>
      </footer>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => { setToast(null); reset(); }} />
      )}

      {showDocs && <DocsModal onClose={() => setShowDocs(false)} />}

      {showWalletModal && (
        <WalletModal
          onConnect={connect}
          onConnectWC={connectWC}
          hasWC={hasWC}
          onClose={() => setShowWalletModal(false)}
        />
      )}

      {/* ── Support chat button ─────────────────────────────────────────── */}
      <a
        href="https://t.me/tyronzethbridge"
        target="_blank"
        rel="noreferrer"
        title="Support"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,212,170,0.4)',
          textDecoration: 'none',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,212,170,0.6)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,212,170,0.4)';
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </a>
    </div>
  );
}

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useMintPass, PHASE, PHASE_LABEL } from '../hooks/useMintPass';

const EXPLORER = 'https://evm.taostats.io/tx/';

function PassIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="passGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#00d4aa" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <rect x="4" y="12" width="40" height="26" rx="5" stroke="url(#passGrad)" strokeWidth="2.2" fill="none" />
      <circle cx="15" cy="25" r="5" stroke="url(#passGrad)" strokeWidth="2" fill="none" />
      <line x1="24" y1="21" x2="38" y2="21" stroke="url(#passGrad)" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="25" x2="38" y2="25" stroke="url(#passGrad)" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="29" x2="32" y2="29" stroke="url(#passGrad)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PhaseTag({ phase }) {
  const colors = {
    [PHASE.CLOSED]:       { bg: 'rgba(248,113,113,0.12)', color: '#f87171', dot: '#f87171' },
    [PHASE.WHITELIST]:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6', dot: '#3b82f6' },
    [PHASE.EARLY_ACCESS]: { bg: 'rgba(0,212,170,0.12)',   color: '#00d4aa', dot: '#00d4aa' },
    [PHASE.PUBLIC]:       { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', dot: '#4ade80' },
  };
  const c = colors[phase] || colors[PHASE.CLOSED];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:99,
      background:c.bg, color:c.color, fontSize:'0.78rem', fontWeight:600 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot,
        boxShadow:`0 0 6px ${c.dot}`, animation: phase !== PHASE.CLOSED ? 'pulse-dot 1.8s infinite' : 'none' }} />
      {PHASE_LABEL[phase]}
    </span>
  );
}

function CountdownTimer({ seconds }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (
    <span style={{ fontVariantNumeric:'tabular-nums', fontWeight:700, color:'var(--cyan)' }}>
      {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
}

export default function MintPass({ address, signer, chainId, switchChain, connect }) {
  const {
    passAddress, phase, totalSupply, availableSupply,
    userBalance, canFreeMint, isEarlyAccess, isWhitelisted,
    mintPrice, maxSupply, timeLeft, loading, minting, txHash, error, mint,
  } = useMintPass(address, signer);

  const [qty, setQty] = useState(1);

  const onTAOEVM = chainId === 964;
  const mintPriceF = mintPrice ? parseFloat(ethers.formatEther(mintPrice)) : 0.01;
  const totalCost  = canFreeMint && qty === 1 ? 0 : mintPriceF * qty;

  const soldOut = availableSupply !== null && availableSupply === 0;
  const pct = totalSupply !== null ? Math.round((totalSupply / maxSupply) * 100) : 0;

  function canMint() {
    if (!address || !onTAOEVM || loading || minting || soldOut) return false;
    if (phase === PHASE.CLOSED) return false;
    if (canFreeMint && qty === 1) return true;
    if (phase === PHASE.WHITELIST) return isWhitelisted;
    if (phase === PHASE.EARLY_ACCESS) return isEarlyAccess;
    if (phase === PHASE.PUBLIC) return true;
    return false;
  }

  function mintLabel() {
    if (!address) return 'Connect Wallet';
    if (!onTAOEVM) return 'Switch to Bittensor EVM';
    if (loading) return 'Loading...';
    if (minting) return <><span className="spinner" style={{width:14,height:14}} /> Minting...</>;
    if (soldOut) return 'Sold Out';
    if (phase === PHASE.CLOSED) return 'Mint Closed';
    if (canFreeMint && qty === 1) return 'Free Mint ✦';
    if (phase === PHASE.WHITELIST && !isWhitelisted) return 'Not Whitelisted';
    if (phase === PHASE.EARLY_ACCESS && !isEarlyAccess) return 'Not in Early Access';
    return `Mint ${qty > 1 ? qty + ' passes' : 'Pass'} — ${totalCost === 0 ? 'Free' : totalCost.toFixed(4) + ' TAO'}`;
  }

  function handleMintClick() {
    if (!address) { connect(); return; }
    if (!onTAOEVM) { switchChain(964); return; }
    mint(qty);
  }

  return (
    <main className="mint-page">
      {/* ── Hero ── */}
      <section className="mint-hero">
        <div className="mint-hero-icon"><PassIcon size={56} /></div>
        <h1 className="mint-hero-title">
          TAOflow <span className="grad">Pass</span>
        </h1>
        <p className="mint-hero-sub">
          Utility NFT for the TAOflow ecosystem.<br />
          Holders bridge with <strong style={{color:'var(--cyan)'}}>0% fees</strong> across all chains.
        </p>
      </section>

      <div className="mint-layout">
        {/* ── Left: Mint card ── */}
        <div className="mint-card">
          {/* NFT preview */}
          <div className="mint-nft-preview">
            <div className="mint-nft-glow" />
            <img
              src="/nft.png"
              alt="TAOflow Pass NFT"
              style={{ width: '100%', maxWidth: 280, borderRadius: 12, display: 'block',
                filter: 'drop-shadow(0 0 28px rgba(0,212,170,0.35))' }}
            />
            <div style={{marginTop:14}}>
              {phase !== null && <PhaseTag phase={phase} />}
            </div>
          </div>

          {/* Supply bar */}
          <div className="mint-supply-wrap">
            <div className="mint-supply-row">
              <span style={{color:'var(--text-muted)', fontSize:'0.82rem'}}>Minted</span>
              <span style={{fontWeight:700, fontSize:'0.9rem'}}>
                {totalSupply ?? '—'} <span style={{color:'var(--text-muted)',fontWeight:400}}>/ {maxSupply}</span>
              </span>
            </div>
            <div className="mint-progress-bar">
              <div className="mint-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
              <span>{pct}% minted</span>
              <span>{availableSupply ?? '—'} remaining</span>
            </div>
          </div>

          {/* Early access timer */}
          {phase === PHASE.EARLY_ACCESS && timeLeft > 0 && (
            <div className="mint-timer-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span style={{color:'var(--text-sub)',fontSize:'0.82rem'}}>Early access ends in </span>
              <CountdownTimer seconds={timeLeft} />
            </div>
          )}

          {/* Status pills */}
          {address && (
            <div className="mint-status-pills">
              {userBalance > 0 && (
                <div className="mint-status-pill green">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  You hold {userBalance} pass{userBalance > 1 ? 'es' : ''} · 0% bridge fee active
                </div>
              )}
              {isWhitelisted && (
                <div className="mint-status-pill blue">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Whitelisted
                </div>
              )}
              {isEarlyAccess && (
                <div className="mint-status-pill cyan">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Early Access
                </div>
              )}
              {canFreeMint && (
                <div className="mint-status-pill grad-pill">
                  ✦ Free mint available
                </div>
              )}
            </div>
          )}

          {/* Quantity selector */}
          {phase !== PHASE.CLOSED && !soldOut && !(canFreeMint) && (
            <div className="mint-qty-row">
              <span style={{color:'var(--text-muted)',fontSize:'0.82rem'}}>Quantity</span>
              <div className="mint-qty-ctrl">
                <button className="mint-qty-btn" onClick={() => setQty(q => Math.max(1,q-1))} disabled={qty<=1}>−</button>
                <span style={{minWidth:28,textAlign:'center',fontWeight:700}}>{qty}</span>
                <button className="mint-qty-btn" onClick={() => setQty(q => Math.min(10,q+1))} disabled={qty>=10}>+</button>
              </div>
            </div>
          )}

          {/* Price row */}
          <div className="mint-price-row">
            <span style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>Price per pass</span>
            <span style={{fontWeight:700}}>
              {canFreeMint && qty === 1
                ? <span className="grad" style={{WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',background:'var(--grad-text)'}}>FREE</span>
                : `${mintPriceF} TAO`}
            </span>
          </div>

          {/* Mint button */}
          <button
            className="btn-mint"
            onClick={handleMintClick}
            disabled={address && onTAOEVM && !canMint()}
          >
            {mintLabel()}
          </button>

          {/* TX link */}
          {txHash && (
            <div style={{textAlign:'center',marginTop:10}}>
              <a className="tx-link" href={EXPLORER + txHash} target="_blank" rel="noreferrer">
                {txHash.slice(0,10)}...{txHash.slice(-6)} ↗
              </a>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mint-error">{error}</div>
          )}

          {/* Not on TAO EVM warning */}
          {address && !onTAOEVM && (
            <div className="mint-warn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Switch to Bittensor EVM (chain 964) to mint
            </div>
          )}
        </div>

        {/* ── Right: Info ── */}
        <div className="mint-info-col">
          {/* Benefits */}
          <div className="mint-info-card">
            <div className="mint-info-title">Pass Benefits</div>
            {[
              { icon: '⚡', title: '0% Bridge Fee', desc: 'Bridge on all chains (ETH, Base, BSC, TAO EVM) with zero fees.' },
              { icon: '🤖', title: 'Trading Bot Access', desc: 'Early access to TAOflow Trading Bot features and upgrades.' },
              { icon: '🎯', title: 'Reward Boosts', desc: 'Boosted rewards on ecosystem activities and future airdrops.' },
              { icon: '🔑', title: 'Ecosystem Access', desc: 'Priority access to all future TAOflow tools and launches.' },
            ].map(b => (
              <div className="mint-benefit-row" key={b.title}>
                <div className="mint-benefit-icon">{b.icon}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:'0.9rem',marginBottom:2}}>{b.title}</div>
                  <div style={{color:'var(--text-muted)',fontSize:'0.8rem',lineHeight:1.5}}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Phases */}
          <div className="mint-info-card">
            <div className="mint-info-title">Mint Phases</div>
            {[
              { phase: PHASE.WHITELIST,    label: 'Whitelist',    desc: '$TFLOW holders — merkle proof required' },
              { phase: PHASE.EARLY_ACCESS, label: 'Early Access', desc: 'VIP wallets added by owner' },
              { phase: PHASE.PUBLIC,       label: 'Public',       desc: 'Open to everyone, no wallet cap' },
            ].map(p => (
              <div key={p.phase} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <PhaseTag phase={p.phase} />
                <span style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>{p.desc}</span>
              </div>
            ))}
            <div style={{color:'var(--text-muted)',fontSize:'0.78rem',marginTop:8,borderTop:'1px solid var(--border)',paddingTop:8}}>
              Free mint available for selected wallets in any non-closed phase.
            </div>
          </div>

          {/* Details */}
          <div className="mint-info-card">
            <div className="mint-info-title">Details</div>
            {[
              ['Supply',   `${maxSupply} total · 20 reserved`],
              ['Price',    '0.01 TAO per pass'],
              ['Chain',    'Bittensor EVM (964)'],
              ['Standard', 'ERC-721A'],
              ['Royalty',  '5%'],
            ].map(([k,v]) => (
              <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:'0.85rem'}}>
                <span style={{color:'var(--text-muted)'}}>{k}</span>
                <span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
            {passAddress && (
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)',fontSize:'0.75rem',color:'var(--text-muted)'}}>
                Contract: <a
                  href={`https://evm.taostats.io/address/${passAddress}`}
                  target="_blank" rel="noreferrer"
                  style={{color:'var(--cyan)',textDecoration:'none'}}
                >
                  {passAddress.slice(0,10)}...{passAddress.slice(-6)} ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

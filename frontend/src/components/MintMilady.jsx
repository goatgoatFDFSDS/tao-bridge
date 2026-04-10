import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useMintMilady } from '../hooks/useMintMilady';

const EXPLORER    = 'https://evm.taostats.io/tx/';
const CONTRACT_TX = 'https://evm.taostats.io/address/0x7A795bd7FfC44b64e7De997cD9732b5614b95694';
const TWITTER     = 'https://x.com/Taomilady';

export default function MintMilady({ address, signer, chainId, switchChain, connect }) {
  const {
    contractAddress, totalMinted, availableSupply, mintOpen,
    mintPrice, maxSupply, maxPerTx, userBalance,
    loading, minting, txHash, error, mint,
  } = useMintMilady(address, signer);

  const [qty, setQty] = useState(1);

  const onTAOEVM  = chainId === 964;
  const soldOut   = availableSupply !== null && availableSupply === 0;
  const pct       = totalMinted !== null ? Math.min(100, Math.round((totalMinted / (maxSupply || 1100)) * 100)) : 0;
  const priceF    = mintPrice ? parseFloat(ethers.formatEther(mintPrice)) : 0.011;
  const totalCost = (priceF * qty).toFixed(4);

  function canMint() {
    return !(!address || !onTAOEVM || loading || minting || soldOut || !mintOpen);
  }

  function handleClick() {
    if (!address)  { connect(); return; }
    if (!onTAOEVM) { switchChain(964); return; }
    mint(qty);
  }

  function mintLabel() {
    if (!address)  return 'Connect Wallet';
    if (!onTAOEVM) return 'Switch to Bittensor EVM';
    if (loading)   return 'Loading...';
    if (minting)   return <><span className="spinner" style={{width:14,height:14,borderWidth:2}} /> Minting...</>;
    if (soldOut)   return 'Sold Out';
    if (!mintOpen) return 'Mint Not Open Yet';
    return `Mint ${qty > 1 ? qty + ' NFTs' : '1 NFT'} — ${totalCost} TAO`;
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', padding:'0 16px 80px' }}>

      {/* ── Noise / grain overlay ── */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.5,
      }} />

      {/* ── Hero banner ── */}
      <div style={{
        width:'100%', maxWidth:900, marginTop:40, position:'relative', zIndex:1,
        borderRadius:24, overflow:'hidden',
        border:'1px solid rgba(255,255,255,0.08)',
        background:'linear-gradient(135deg, rgba(20,10,30,0.95), rgba(10,15,25,0.95))',
        boxShadow:'0 0 80px rgba(180,100,255,0.12), 0 0 40px rgba(0,212,170,0.08)',
      }}>
        {/* CRT scanlines */}
        <div style={{
          position:'absolute', inset:0, zIndex:1, pointerEvents:'none',
          backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        }} />

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 24px 40px', position:'relative', zIndex:2 }}>
          {/* Logo */}
          <div style={{ position:'relative', marginBottom:28 }}>
            <div style={{
              position:'absolute', inset:-12, borderRadius:'50%',
              background:'radial-gradient(circle, rgba(180,100,255,0.25) 0%, transparent 70%)',
              filter:'blur(16px)',
            }} />
            <img
              src="/milady-logo.png"
              alt="TAO Milady"
              style={{
                width:200, height:200, borderRadius:16, display:'block', position:'relative',
                border:'2px solid rgba(180,100,255,0.35)',
                boxShadow:'0 0 40px rgba(180,100,255,0.3), 0 0 80px rgba(180,100,255,0.1)',
                imageRendering:'auto',
              }}
            />
            {/* Live badge */}
            {mintOpen && (
              <div style={{
                position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)',
                background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.4)',
                borderRadius:99, padding:'3px 12px',
                display:'flex', alignItems:'center', gap:5,
                fontSize:'0.72rem', fontWeight:700, color:'#4ade80',
                whiteSpace:'nowrap',
              }}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80',animation:'pulse-dot 1.5s infinite'}} />
                LIVE
              </div>
            )}
          </div>

          {/* Title */}
          <h1 style={{
            margin:'0 0 8px', fontSize:'clamp(2rem, 5vw, 3.2rem)', fontWeight:900,
            letterSpacing:'-0.02em', textAlign:'center', lineHeight:1.1,
            background:'linear-gradient(135deg, #e879f9, #a855f7, #00d4aa)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          }}>
            TAO MILADY
          </h1>
          <p style={{ margin:'0 0 16px', color:'rgba(255,255,255,0.45)', fontSize:'0.9rem', textAlign:'center', letterSpacing:'0.08em' }}>
            1111 UNIQUE NFTs ON BITTENSOR EVM
          </p>

          <a href={TWITTER} target="_blank" rel="noreferrer" style={{
            display:'inline-flex', alignItems:'center', gap:7, marginBottom:28,
            padding:'6px 16px', borderRadius:99,
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
            color:'rgba(255,255,255,0.7)', fontSize:'0.82rem', fontWeight:600,
            textDecoration:'none', transition:'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.7)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            @Taomilady
          </a>

          {/* Supply bar */}
          <div style={{ width:'100%', maxWidth:440, marginBottom:32 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'0.8rem' }}>
              <span style={{ color:'rgba(255,255,255,0.5)' }}>Minted</span>
              <span style={{ color:'#fff', fontWeight:700 }}>
                {totalMinted ?? '—'}
                <span style={{ color:'rgba(255,255,255,0.35)', fontWeight:400 }}> / {maxSupply ?? 1100}</span>
              </span>
            </div>
            <div style={{
              height:6, borderRadius:99, background:'rgba(255,255,255,0.08)',
              overflow:'hidden', position:'relative',
            }}>
              <div style={{
                position:'absolute', inset:'0 auto 0 0', width:`${pct}%`,
                background:'linear-gradient(90deg, #a855f7, #e879f9, #00d4aa)',
                borderRadius:99, transition:'width 0.8s ease',
                boxShadow:'0 0 12px rgba(168,85,247,0.6)',
              }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:'0.73rem', color:'rgba(255,255,255,0.35)' }}>
              <span>{pct}% minted</span>
              <span>{availableSupply ?? '—'} remaining</span>
            </div>
          </div>

          {/* Mint card */}
          <div style={{
            width:'100%', maxWidth:440,
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:20, padding:'24px',
          }}>
            {/* Price */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem' }}>Price per NFT</span>
              <span style={{
                fontWeight:800, fontSize:'1.1rem',
                background:'linear-gradient(90deg, #e879f9, #a855f7)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
              }}>
                {priceF} TAO
              </span>
            </div>

            {/* Qty selector */}
            {mintOpen && !soldOut && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem' }}>Quantity</span>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <button
                    onClick={() => setQty(q => Math.max(1, q-1))}
                    disabled={qty <= 1}
                    style={{
                      width:32, height:32, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.15)',
                      background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:'1rem',
                      cursor:qty<=1?'not-allowed':'pointer', opacity:qty<=1?0.3:1,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>−</button>
                  <span style={{ fontWeight:800, fontSize:'1.2rem', minWidth:24, textAlign:'center' }}>{qty}</span>
                  <button
                    onClick={() => setQty(q => Math.min(maxPerTx || 10, q+1))}
                    disabled={qty >= (maxPerTx || 10)}
                    style={{
                      width:32, height:32, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.15)',
                      background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:'1rem',
                      cursor:qty>=(maxPerTx||10)?'not-allowed':'pointer', opacity:qty>=(maxPerTx||10)?0.3:1,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>+</button>
                </div>
              </div>
            )}

            {/* Total */}
            {mintOpen && qty > 1 && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20,
                paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem' }}>Total</span>
                <span style={{ fontWeight:800, color:'#fff' }}>{totalCost} TAO</span>
              </div>
            )}

            {/* Mint button */}
            <button
              onClick={handleClick}
              disabled={address && onTAOEVM && !canMint()}
              style={{
                width:'100%', padding:'15px', borderRadius:14, border:'none',
                background: canMint() || !address || !onTAOEVM
                  ? 'linear-gradient(135deg, #a855f7, #e879f9, #7c3aed)'
                  : 'rgba(255,255,255,0.08)',
                color:'#fff', fontWeight:800, fontSize:'1rem', cursor:'pointer',
                letterSpacing:'0.02em',
                boxShadow: canMint() || !address || !onTAOEVM
                  ? '0 0 30px rgba(168,85,247,0.4), 0 4px 20px rgba(168,85,247,0.3)'
                  : 'none',
                transition:'all 0.2s', opacity: address && onTAOEVM && !canMint() && mintOpen ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (canMint() || !address) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {mintLabel()}
            </button>

            {/* User balance */}
            {address && userBalance > 0 && (
              <div style={{
                marginTop:14, textAlign:'center',
                background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.2)',
                borderRadius:10, padding:'8px 12px', fontSize:'0.82rem',
                color:'#c084fc',
              }}>
                You own {userBalance} TAO Milady {userBalance > 1 ? 'NFTs' : 'NFT'}
              </div>
            )}

            {/* TX link */}
            {txHash && (
              <div style={{ marginTop:12, textAlign:'center' }}>
                <a href={EXPLORER + txHash} target="_blank" rel="noreferrer"
                  style={{ color:'#00d4aa', fontSize:'0.8rem', textDecoration:'none', fontWeight:600 }}>
                  ✓ View transaction ↗
                </a>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                marginTop:12, padding:'10px 14px', borderRadius:10,
                background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)',
                color:'#f87171', fontSize:'0.8rem',
              }}>
                {error}
              </div>
            )}

            {/* Wrong chain */}
            {address && !onTAOEVM && (
              <div style={{
                marginTop:12, padding:'10px 14px', borderRadius:10,
                background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)',
                color:'#fbbf24', fontSize:'0.8rem', textAlign:'center',
              }}>
                Switch to Bittensor EVM (chain 964)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Info row ── */}
      <div style={{
        width:'100%', maxWidth:900, marginTop:20, position:'relative', zIndex:1,
        display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12,
      }}>
        {[
          { label:'Supply',   value:'1111 NFTs' },
          { label:'Price',    value:'0.011 TAO' },
          { label:'Max / tx', value:'10 NFTs' },
          { label:'Chain',    value:'Bittensor EVM' },
          { label:'Standard', value:'ERC-721' },
          { label:'Contract', value: contractAddress ? contractAddress.slice(0,8)+'…' : '—', link: CONTRACT_TX },
        ].map(({ label, value, link }) => (
          <div key={label} style={{
            background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:14, padding:'14px 18px',
            display:'flex', flexDirection:'column', gap:4,
          }}>
            <span style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</span>
            {link
              ? <a href={link} target="_blank" rel="noreferrer" style={{ color:'#a855f7', fontWeight:700, fontSize:'0.9rem', textDecoration:'none' }}>{value} ↗</a>
              : <span style={{ color:'#fff', fontWeight:700, fontSize:'0.9rem' }}>{value}</span>
            }
          </div>
        ))}
      </div>

    </div>
  );
}

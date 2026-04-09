import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePools } from '../hooks/usePools';
import { DEX_CONTRACTS, ERC20_ABI } from '../hooks/useSwap';

const BITTENSOR_RPC = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';

const KNOWN_TOKENS = [
  { symbol: 'TAO',   address: DEX_CONTRACTS.WTAO,  color: '#00d4aa', bg: 'rgba(0,212,170,0.15)', decimals: 18 },
  { symbol: 'TFLOW', address: DEX_CONTRACTS.TFLOW, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', decimals: 18 },
];

function getDecimals(addr) {
  const t = KNOWN_TOKENS.find(t => t.address.toLowerCase() === addr?.toLowerCase());
  return t ? t.decimals : 18;
}

function TokenChips({ value, onChange, exclude }) {
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {KNOWN_TOKENS.filter(t => t.address.toLowerCase() !== exclude?.toLowerCase()).map(t => {
        const active = value.toLowerCase() === t.address.toLowerCase();
        return (
          <button key={t.address} onClick={() => onChange(t.address)}
            style={{
              display:'flex', alignItems:'center', gap:7, padding:'8px 14px',
              borderRadius:10, border:`1.5px solid ${active ? t.color : 'var(--border)'}`,
              background: active ? t.bg : 'var(--bg-input)',
              cursor:'pointer', transition:'all .15s',
            }}>
            <div style={{ width:20, height:20, borderRadius:'50%', background:t.bg, border:`1.5px solid ${t.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, color:t.color }}>
              {t.symbol.slice(0,2)}
            </div>
            <span style={{ fontWeight:600, fontSize:'0.88rem', color: active ? t.color : 'var(--text)' }}>{t.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({ value, onChange, symbol, balance, color, onMax }) {
  const tok = KNOWN_TOKENS.find(t => t.symbol === symbol);
  const c = tok?.color || color || 'var(--text-muted)';
  const bg = tok?.bg || 'rgba(255,255,255,0.06)';
  return (
    <div style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <input type="number" placeholder="0" value={value} onChange={e => onChange(e.target.value)}
          style={{ background:'none', border:'none', outline:'none', color:'var(--text)', fontSize:'1.5rem', fontWeight:500, width:'55%', padding:0 }} />
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:bg, border:`1.5px solid ${c}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:c }}>
              {symbol?.slice(0,2)}
            </div>
            <span style={{ fontWeight:700, fontSize:'0.95rem', color:c }}>{symbol}</span>
          </div>
          {balance !== undefined && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                {parseFloat(balance || 0).toFixed(4)} {symbol}
              </span>
              {onMax && parseFloat(balance) > 0 && (
                <button onClick={onMax}
                  style={{ fontSize:'0.65rem', fontWeight:700, color:c, background: bg, border:`1px solid ${c}`, borderRadius:4, padding:'1px 5px', cursor:'pointer' }}>
                  MAX
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Pool row (existing pools) ─────────────────────────────────────────── */
function PoolRow({ pair, address, signer, onRefresh }) {
  const { addLiquidityETH, removeLiquidityETH, PAIR_ABI } = usePools();
  const [expanded,   setExpanded]   = useState(false);
  const [mode,       setMode]       = useState('add');
  const [lpBalance,  setLpBalance]  = useState('0');
  const [taoBalance, setTaoBalance] = useState('0');
  const [tokBalance, setTokBalance] = useState('0');
  const [amountETH,  setAmountETH]  = useState('');
  const [amountTok,  setAmountTok]  = useState('');
  const [removePct,  setRemovePct]  = useState(100);
  const [loading,    setLoading]    = useState(false);
  const [txHash,     setTxHash]     = useState(null);

  const isWTAOPair = pair.token0.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase()
                  || pair.token1.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase();
  const taoIsToken0 = pair.token0.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase();
  const otherToken  = isWTAOPair ? (taoIsToken0 ? pair.token1 : pair.token0) : null;
  const otherMeta   = isWTAOPair ? (taoIsToken0 ? pair.meta1 : pair.meta0) : null;
  const taoReserveF = parseFloat(ethers.formatEther(taoIsToken0 ? pair.reserve0 : pair.reserve1));
  const tokReserveF = parseFloat(ethers.formatUnits(taoIsToken0 ? pair.reserve1 : pair.reserve0, otherMeta?.decimals || 18));
  const priceRatio  = taoReserveF > 0 ? tokReserveF / taoReserveF : 0;

  useEffect(() => {
    if (!address || !expanded) return;
    const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
    new ethers.Contract(pair.address, PAIR_ABI, provider)
      .balanceOf(address).then(b => setLpBalance(ethers.formatEther(b))).catch(() => {});
    provider.getBalance(address).then(b => setTaoBalance(ethers.formatEther(b))).catch(() => {});
    if (otherToken && otherMeta) {
      new ethers.Contract(otherToken, ERC20_ABI, provider)
        .balanceOf(address).then(b => setTokBalance(ethers.formatUnits(b, otherMeta.decimals))).catch(() => {});
    }
  }, [address, expanded, pair.address, PAIR_ABI, otherToken, otherMeta]);

  const handleTAOInput = v => { setAmountETH(v); if (v && priceRatio > 0) setAmountTok((parseFloat(v) * priceRatio).toFixed(6)); else setAmountTok(''); };
  const handleTokInput = v => { setAmountTok(v); if (v && priceRatio > 0) setAmountETH((parseFloat(v) / priceRatio).toFixed(6)); else setAmountETH(''); };

  const handleAdd = async () => {
    if (!signer || !isWTAOPair) return;
    setLoading(true); setTxHash(null);
    try {
      const hash = await addLiquidityETH(signer, {
        token: otherToken,
        amountToken: ethers.parseUnits(amountTok || '0', otherMeta.decimals),
        amountETH: ethers.parseEther(amountETH || '0'),
        to: address,
      });
      setTxHash(hash); setAmountETH(''); setAmountTok(''); onRefresh();
    } catch (e) { alert(e?.shortMessage || e?.message || 'Add liquidity failed'); }
    setLoading(false);
  };

  const handleRemove = async () => {
    if (!signer || !isWTAOPair) return;
    setLoading(true); setTxHash(null);
    try {
      const totalLP = ethers.parseEther(lpBalance);
      const hash = await removeLiquidityETH(signer, { token: otherToken, liquidity: totalLP * BigInt(removePct) / 100n, to: address });
      setTxHash(hash); onRefresh();
    } catch (e) { alert(e?.shortMessage || e?.message || 'Remove liquidity failed'); }
    setLoading(false);
  };

  const r0f = ethers.formatUnits(pair.reserve0, pair.meta0.decimals);
  const r1f = ethers.formatUnits(pair.reserve1, pair.meta1.decimals);
  const hasAmount = amountETH && parseFloat(amountETH) > 0;

  return (
    <div className="pool-row">
      <div className="pool-row-main" onClick={() => setExpanded(e => !e)}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
          <div style={{ display:'flex' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(0,212,170,0.18)', border:'1.5px solid #00d4aa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#00d4aa', marginRight:-6, zIndex:2 }}>
              {pair.meta0.symbol.slice(0,3)}
            </div>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(59,130,246,0.18)', border:'1.5px solid #3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#3b82f6' }}>
              {pair.meta1.symbol.slice(0,3)}
            </div>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{pair.meta0.symbol}/{pair.meta1.symbol}</div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{pair.address.slice(0,8)}...{pair.address.slice(-6)}</div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Reserves</div>
          <div style={{ fontSize:'0.85rem' }}>{parseFloat(r0f).toFixed(4)} / {parseFloat(r1f).toFixed(4)}</div>
        </div>
        {address && (
          <div style={{ textAlign:'right', minWidth:80 }}>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>My LP</div>
            <div style={{ fontSize:'0.88rem', color:'var(--cyan)' }}>{parseFloat(lpBalance).toFixed(6)}</div>
          </div>
        )}
        <div style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && isWTAOPair && (
        <div className="pool-expand">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700 }}>TAO / {otherMeta?.symbol}</span>
              <span style={{ background:'rgba(59,130,246,0.12)', color:'#60a5fa', fontSize:'0.68rem', fontWeight:600, padding:'2px 7px', borderRadius:4, border:'1px solid rgba(59,130,246,0.2)' }}>v2</span>
              <span style={{ background:'rgba(0,212,170,0.1)', color:'var(--cyan)', fontSize:'0.68rem', fontWeight:600, padding:'2px 7px', borderRadius:4, border:'1px solid rgba(0,212,170,0.18)' }}>0.3%</span>
            </div>
            <button onClick={e => { e.stopPropagation(); setMode(m => m === 'add' ? 'remove' : 'add'); setTxHash(null); }}
              style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.82rem', color:'var(--text-sub)' }}>
              {mode === 'add' ? 'Remove' : 'Add'}
            </button>
          </div>

          {priceRatio > 0 && (
            <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(0,212,170,0.05)', borderRadius:10, border:'1px solid rgba(0,212,170,0.12)' }}>
              <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Current price </span>
              <span style={{ fontWeight:600 }}>{priceRatio.toFixed(6)}</span>
              <span style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}> {otherMeta?.symbol}/TAO</span>
            </div>
          )}

          {mode === 'add' ? (
            <>
              <div style={{ fontWeight:600, fontSize:'0.92rem', marginBottom:12 }}>Deposit tokens</div>
              <AmountInput value={amountETH} onChange={handleTAOInput} symbol="TAO" balance={taoBalance}
                onMax={() => handleTAOInput(taoBalance)} />
              <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.8rem', margin:'6px 0' }}>+</div>
              <AmountInput value={amountTok} onChange={handleTokInput} symbol={otherMeta?.symbol} balance={tokBalance}
                onMax={() => handleTokInput(tokBalance)} />
              <button className="btn-bridge" style={{ padding:'14px 0', width:'100%', fontSize:'0.9rem', marginTop:14 }}
                onClick={handleAdd} disabled={loading || !signer || !hasAmount}>
                {!signer ? 'Connect Wallet' : loading ? <><div className="spinner" />Working...</> : hasAmount ? 'Add Liquidity' : 'Enter an amount'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontWeight:600, fontSize:'0.92rem', marginBottom:8 }}>Remove liquidity</div>
              <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:10 }}>
                My LP: <span style={{ color:'var(--text)', fontWeight:600 }}>{parseFloat(lpBalance).toFixed(6)}</span>
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                {[25,50,75,100].map(p => (
                  <button key={p} onClick={() => setRemovePct(p)}
                    style={{ flex:1, padding:'7px 0', borderRadius:8, border:`1px solid ${removePct===p ? 'var(--cyan)' : 'var(--border)'}`, background: removePct===p ? 'rgba(0,212,170,0.12)' : 'var(--bg-input)', color: removePct===p ? 'var(--cyan)' : 'var(--text-muted)', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 }}>
                    {p}%
                  </button>
                ))}
              </div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:14 }}>
                Removing: <span style={{ color:'var(--text)' }}>{(parseFloat(lpBalance) * removePct / 100).toFixed(6)} LP</span>
              </div>
              <button className="btn-bridge"
                style={{ padding:'14px 0', width:'100%', fontSize:'0.9rem', background:'linear-gradient(90deg,#f87171,#ef4444)' }}
                onClick={handleRemove} disabled={loading || !signer || parseFloat(lpBalance) <= 0}>
                {loading ? <><div className="spinner" />Working...</> : 'Remove Liquidity'}
              </button>
            </>
          )}

          {txHash && (
            <div style={{ marginTop:12, textAlign:'center' }}>
              <a className="tx-link" href={`https://evm.taostats.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                {txHash.slice(0,10)}...{txHash.slice(-6)} ↗
              </a>
            </div>
          )}
        </div>
      )}

      {expanded && !isWTAOPair && (
        <div className="pool-expand" style={{ color:'var(--text-muted)', fontSize:'0.85rem', textAlign:'center' }}>
          Non-TAO pairs: use the contract directly.
        </div>
      )}
    </div>
  );
}

/* ─── Main Pools page ────────────────────────────────────────────────────── */
export default function Pools({ address, signer, chainId, connect, switchChain }) {
  const { pairs, loading, error, fetchPairs, addLiquidityETH, addLiquidity } = usePools();
  const [newTokenA, setNewTokenA] = useState(DEX_CONTRACTS.WTAO);
  const [newTokenB, setNewTokenB] = useState(DEX_CONTRACTS.TFLOW);
  const [amountA,   setAmountA]   = useState('');
  const [amountB,   setAmountB]   = useState('');
  const [balanceA,  setBalanceA]  = useState('0');
  const [balanceB,  setBalanceB]  = useState('0');
  const [creating,  setCreating]  = useState(false);
  const [createTx,  setCreateTx]  = useState(null);

  const isOnBittensor = chainId === 964;
  const tokenAisTAO = newTokenA.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase();
  const tokenBisTAO = newTokenB.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase();
  const metaA = KNOWN_TOKENS.find(t => t.address.toLowerCase() === newTokenA.toLowerCase());
  const metaB = KNOWN_TOKENS.find(t => t.address.toLowerCase() === newTokenB.toLowerCase());
  const symA  = metaA?.symbol || 'Token A';
  const symB  = metaB?.symbol || 'Token B';

  // Fetch balances for selected tokens
  useEffect(() => {
    if (!address) { setBalanceA('0'); setBalanceB('0'); return; }
    const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
    if (tokenAisTAO) {
      provider.getBalance(address).then(b => setBalanceA(ethers.formatEther(b))).catch(() => {});
    } else {
      new ethers.Contract(newTokenA, ERC20_ABI, provider)
        .balanceOf(address).then(b => setBalanceA(ethers.formatUnits(b, getDecimals(newTokenA)))).catch(() => {});
    }
    if (tokenBisTAO) {
      provider.getBalance(address).then(b => setBalanceB(ethers.formatEther(b))).catch(() => {});
    } else {
      new ethers.Contract(newTokenB, ERC20_ABI, provider)
        .balanceOf(address).then(b => setBalanceB(ethers.formatUnits(b, getDecimals(newTokenB)))).catch(() => {});
    }
  }, [address, newTokenA, newTokenB, tokenAisTAO, tokenBisTAO]);

  const handleCreatePool = async () => {
    if (!signer) { connect(); return; }
    if (!isOnBittensor) { switchChain(964); return; }
    if (!amountA || !amountB) return;
    setCreating(true); setCreateTx(null);
    try {
      let hash;
      if (tokenAisTAO) {
        hash = await addLiquidityETH(signer, { token: newTokenB, amountToken: ethers.parseUnits(amountB, getDecimals(newTokenB)), amountETH: ethers.parseEther(amountA), to: address });
      } else if (tokenBisTAO) {
        hash = await addLiquidityETH(signer, { token: newTokenA, amountToken: ethers.parseUnits(amountA, getDecimals(newTokenA)), amountETH: ethers.parseEther(amountB), to: address });
      } else {
        hash = await addLiquidity(signer, { tokenA: newTokenA, tokenB: newTokenB, amountA: ethers.parseUnits(amountA, getDecimals(newTokenA)), amountB: ethers.parseUnits(amountB, getDecimals(newTokenB)), to: address });
      }
      setCreateTx(hash); setAmountA(''); setAmountB(''); fetchPairs();
    } catch (e) { alert(e?.shortMessage || e?.message || 'Create pool failed'); }
    setCreating(false);
  };

  const canCreate = amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0;

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1 className="page-title">Liquidity Pools</h1>
        <p className="page-sub">Provide liquidity and earn 0.3% on every swap</p>
      </div>

      <div className="swap-wrap">

        {/* ── Create New Pool card ─────────────────────────────────────── */}
        <div className="bridge-card" style={{ width:'min(480px, 100%)', padding:'24px 24px 20px' }}>
          <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:20 }}>Create New Pool</div>

          {/* Select pair */}
          <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>Select pair</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:6 }}>Token A</div>
              <TokenChips value={newTokenA} onChange={v => { setNewTokenA(v); setAmountA(''); setAmountB(''); }} exclude={newTokenB} />
            </div>
            <div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:6 }}>Token B</div>
              <TokenChips value={newTokenB} onChange={v => { setNewTokenB(v); setAmountA(''); setAmountB(''); }} exclude={newTokenA} />
            </div>
          </div>

          {/* Pair badge */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:10, border:'1px solid var(--border)' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Pair</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background: metaA?.bg || 'rgba(255,255,255,0.1)', border:`1.5px solid ${metaA?.color || '#888'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:800, color: metaA?.color }}>{symA.slice(0,2)}</div>
              <span style={{ fontWeight:700, color: metaA?.color || 'var(--text)' }}>{symA}</span>
              <span style={{ color:'var(--text-muted)' }}>/</span>
              <div style={{ width:18, height:18, borderRadius:'50%', background: metaB?.bg || 'rgba(255,255,255,0.1)', border:`1.5px solid ${metaB?.color || '#888'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:800, color: metaB?.color }}>{symB.slice(0,2)}</div>
              <span style={{ fontWeight:700, color: metaB?.color || 'var(--text)' }}>{symB}</span>
            </div>
            <span style={{ marginLeft:'auto', fontSize:'0.68rem', color:'#60a5fa', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:4, padding:'2px 7px', fontWeight:600 }}>v2</span>
            <span style={{ fontSize:'0.68rem', color:'var(--cyan)', background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.18)', borderRadius:4, padding:'2px 7px', fontWeight:600 }}>0.3%</span>
          </div>

          {/* Initial deposit */}
          <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>Initial deposit</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
            <AmountInput value={amountA} onChange={setAmountA} symbol={symA} balance={address ? balanceA : undefined}
              onMax={() => setAmountA(balanceA)} />
            <AmountInput value={amountB} onChange={setAmountB} symbol={symB} balance={address ? balanceB : undefined}
              onMax={() => setAmountB(balanceB)} />
          </div>

          <button className="btn-bridge" style={{ padding:'14px 0', width:'100%', fontSize:'0.92rem' }}
            onClick={handleCreatePool} disabled={creating || (signer && !canCreate)}>
            {creating
              ? <><div className="spinner" />Creating...</>
              : !signer
                ? 'Connect Wallet'
                : !canCreate
                  ? 'Enter amounts'
                  : `Create ${symA} / ${symB} Pool`}
          </button>

          {createTx && (
            <div style={{ marginTop:12, textAlign:'center' }}>
              <a className="tx-link" href={`https://evm.taostats.io/tx/${createTx}`} target="_blank" rel="noreferrer">
                Pool created! {createTx.slice(0,10)}... ↗
              </a>
            </div>
          )}
        </div>

        {/* ── Existing pools ───────────────────────────────────────────── */}
        <div style={{ width:'min(480px, 100%)', padding:'0 20px', boxSizing:'border-box' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', fontWeight:600 }}>
              {loading ? 'Loading pools...' : `${pairs.length} pool${pairs.length !== 1 ? 's' : ''}`}
            </div>
            <button className="dir-tab" onClick={fetchPairs} style={{ padding:'6px 12px', fontSize:'0.8rem' }}>Refresh</button>
          </div>

          {error && (
            <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'var(--radius-sm)', padding:'12px 16px', color:'var(--red)', marginBottom:12 }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
              <div className="spinner" style={{ margin:'0 auto 10px', borderColor:'rgba(0,212,170,0.2)', borderTopColor:'#00d4aa' }} />
              Loading pools...
            </div>
          )}

          {!loading && pairs.length === 0 && (
            <div className="bridge-card" style={{ textAlign:'center', padding:'32px 24px' }}>
              <div style={{ fontSize:'1.8rem', marginBottom:10 }}>🌊</div>
              <div style={{ fontWeight:600, marginBottom:4 }}>No pools yet</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Be the first to create a liquidity pool.</div>
            </div>
          )}

          {!loading && pairs.map(pair => (
            <PoolRow key={pair.address} pair={pair} address={address} signer={signer} onRefresh={fetchPairs} />
          ))}
        </div>

        {/* ── Info bar ─────────────────────────────────────────────────── */}
        <div style={{ width:'min(480px, 100%)', padding:'0 20px', boxSizing:'border-box' }}>
          <div className="bridge-card" style={{ padding:'14px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-around', alignItems:'center' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:3 }}>Earn on swaps</div>
                <div style={{ fontWeight:700, color:'var(--cyan)', fontSize:'1rem' }}>0.3% fees</div>
              </div>
              <div style={{ width:1, height:32, background:'var(--border)' }} />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:3 }}>Protocol fee</div>
                <div style={{ fontWeight:700, fontSize:'1rem' }}>0%</div>
              </div>
              <div style={{ width:1, height:32, background:'var(--border)' }} />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:3 }}>DEX</div>
                <div style={{ fontWeight:700, fontSize:'1rem' }}>TAOflow V2</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

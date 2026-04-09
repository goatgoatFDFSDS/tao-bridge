import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePools } from '../hooks/usePools';
import { DEX_CONTRACTS, ERC20_ABI } from '../hooks/useSwap';

const BITTENSOR_RPC = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';

const KNOWN_TOKENS = [
  { symbol: 'TAO',   address: DEX_CONTRACTS.WTAO,  color: '#00d4aa', bg: 'rgba(0,212,170,0.15)' },
  { symbol: 'TFLOW', address: DEX_CONTRACTS.TFLOW, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { symbol: 'USDC',  address: DEX_CONTRACTS.USDC,  color: '#2775ca', bg: 'rgba(39,117,202,0.15)' },
];

function TokenPicker({ label, value, onChange }) {
  const [custom, setCustom] = useState(false);
  const selected = KNOWN_TOKENS.find(t => t.address.toLowerCase() === value.toLowerCase());

  return (
    <div>
      <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:8 }}>{label}</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
        {KNOWN_TOKENS.map(t => (
          <button key={t.address}
            onClick={() => { onChange(t.address); setCustom(false); }}
            style={{
              display:'flex', alignItems:'center', gap:7, padding:'8px 14px',
              borderRadius:10, border: `1.5px solid ${value.toLowerCase() === t.address.toLowerCase() ? t.color : 'var(--border)'}`,
              background: value.toLowerCase() === t.address.toLowerCase() ? t.bg : 'var(--bg-input)',
              cursor:'pointer', transition:'all .15s',
            }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:t.bg, border:`1.5px solid ${t.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:t.color }}>
              {t.symbol.slice(0,2)}
            </div>
            <span style={{ fontWeight:600, fontSize:'0.88rem', color: value.toLowerCase() === t.address.toLowerCase() ? t.color : 'var(--text)' }}>{t.symbol}</span>
          </button>
        ))}
        <button
          onClick={() => setCustom(c => !c)}
          style={{
            padding:'8px 14px', borderRadius:10,
            border:`1.5px solid ${custom ? 'rgba(168,85,247,0.6)' : 'var(--border)'}`,
            background: custom ? 'rgba(168,85,247,0.1)' : 'var(--bg-input)',
            cursor:'pointer', fontSize:'0.82rem', color: custom ? '#c084fc' : 'var(--text-muted)',
          }}>
          Custom
        </button>
      </div>
      {custom && (
        <input className="recipient-input" placeholder="0x..."
          value={selected ? '' : value}
          onChange={e => onChange(e.target.value)}
          style={{ marginTop:4 }} />
      )}
      {selected && !custom && (
        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'monospace', marginTop:2 }}>
          {selected.address.slice(0,14)}...{selected.address.slice(-6)}
        </div>
      )}
    </div>
  );
}

function PoolRow({ pair, address, signer, onRefresh }) {
  const { addLiquidityETH, removeLiquidityETH, PAIR_ABI } = usePools();
  const [expanded,   setExpanded]   = useState(false);
  const [mode,       setMode]       = useState('add');  // 'add' | 'remove'
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
  const otherToken  = isWTAOPair
    ? (taoIsToken0 ? pair.token1 : pair.token0) : null;
  const otherMeta   = isWTAOPair
    ? (taoIsToken0 ? pair.meta1 : pair.meta0) : null;

  const taoReserveF = parseFloat(ethers.formatEther(taoIsToken0 ? pair.reserve0 : pair.reserve1));
  const tokReserveF = parseFloat(ethers.formatUnits(taoIsToken0 ? pair.reserve1 : pair.reserve0, otherMeta?.decimals || 18));
  const priceRatio  = taoReserveF > 0 ? tokReserveF / taoReserveF : 0; // tokens per TAO

  useEffect(() => {
    if (!address) return;
    const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
    new ethers.Contract(pair.address, PAIR_ABI, provider)
      .balanceOf(address).then(b => setLpBalance(ethers.formatEther(b))).catch(() => {});
    provider.getBalance(address).then(b => setTaoBalance(ethers.formatEther(b))).catch(() => {});
    if (otherToken && otherMeta) {
      new ethers.Contract(otherToken, ERC20_ABI, provider)
        .balanceOf(address).then(b => setTokBalance(ethers.formatUnits(b, otherMeta.decimals))).catch(() => {});
    }
  }, [address, pair.address, PAIR_ABI, otherToken, otherMeta]);

  const handleTAOInput = (val) => {
    setAmountETH(val);
    if (val && priceRatio > 0) setAmountTok((parseFloat(val) * priceRatio).toFixed(6));
    else setAmountTok('');
  };
  const handleTokInput = (val) => {
    setAmountTok(val);
    if (val && priceRatio > 0) setAmountETH((parseFloat(val) / priceRatio).toFixed(6));
    else setAmountETH('');
  };

  const handleAdd = async () => {
    if (!signer || !isWTAOPair) return;
    setLoading(true); setTxHash(null);
    try {
      const rawETH = ethers.parseEther(amountETH || '0');
      const rawTok = ethers.parseUnits(amountTok || '0', otherMeta.decimals);
      const hash = await addLiquidityETH(signer, { token: otherToken, amountToken: rawTok, amountETH: rawETH, to: address });
      setTxHash(hash);
      setAmountETH(''); setAmountTok('');
      onRefresh();
    } catch (e) {
      alert(e?.shortMessage || e?.message || 'Add liquidity failed');
    }
    setLoading(false);
  };

  const handleRemove = async () => {
    if (!signer || !isWTAOPair) return;
    setLoading(true); setTxHash(null);
    try {
      const totalLP = ethers.parseEther(lpBalance);
      const removeAmt = totalLP * BigInt(removePct) / 100n;
      const hash = await removeLiquidityETH(signer, { token: otherToken, liquidity: removeAmt, to: address });
      setTxHash(hash);
      onRefresh();
    } catch (e) {
      alert(e?.shortMessage || e?.message || 'Remove liquidity failed');
    }
    setLoading(false);
  };

  const r0f = ethers.formatUnits(pair.reserve0, pair.meta0.decimals);
  const r1f = ethers.formatUnits(pair.reserve1, pair.meta1.decimals);
  const hasAmount = amountETH && parseFloat(amountETH) > 0;

  return (
    <div className="pool-row">
      {/* Collapsed header */}
      <div className="pool-row-main" onClick={() => setExpanded(e => !e)}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center' }}>
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
          <div style={{ fontSize:'0.82rem', color:'var(--text-sub)' }}>Reserves</div>
          <div style={{ fontSize:'0.88rem' }}>{parseFloat(r0f).toFixed(4)} / {parseFloat(r1f).toFixed(4)}</div>
        </div>
        {address && (
          <div style={{ textAlign:'right', minWidth:80 }}>
            <div style={{ fontSize:'0.82rem', color:'var(--text-sub)' }}>My LP</div>
            <div style={{ fontSize:'0.88rem', color:'var(--cyan)' }}>{parseFloat(lpBalance).toFixed(6)}</div>
          </div>
        )}
        <div style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {/* Expanded panel */}
      {expanded && isWTAOPair && (
        <div className="pool-expand">
          {/* Header: pair name + badges + toggle button */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:'0.97rem' }}>
                TAO / {otherMeta?.symbol}
              </span>
              <span style={{ background:'rgba(59,130,246,0.12)', color:'#60a5fa', fontSize:'0.68rem', fontWeight:600, padding:'2px 7px', borderRadius:4, border:'1px solid rgba(59,130,246,0.2)' }}>v2</span>
              <span style={{ background:'rgba(0,212,170,0.1)', color:'var(--cyan)', fontSize:'0.68rem', fontWeight:600, padding:'2px 7px', borderRadius:4, border:'1px solid rgba(0,212,170,0.18)' }}>0.3%</span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setMode(m => m === 'add' ? 'remove' : 'add'); setTxHash(null); }}
              style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.82rem', color:'var(--text-sub)', transition:'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {mode === 'add' ? 'Remove' : 'Add'}
            </button>
          </div>

          {/* Current price */}
          {priceRatio > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:3 }}>Current price</div>
              <div style={{ fontSize:'1.0rem', fontWeight:600 }}>
                {priceRatio.toFixed(6)}{' '}
                <span style={{ color:'var(--text-muted)', fontWeight:400, fontSize:'0.85rem' }}>{otherMeta?.symbol}/TAO</span>
              </div>
            </div>
          )}

          {mode === 'add' ? (
            <>
              <div style={{ fontWeight:600, fontSize:'0.92rem', marginBottom:3 }}>Deposit tokens</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:16 }}>Set the token amounts for your liquidity contribution.</div>

              {/* TAO input box */}
              <div style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <input type="number" placeholder="0" value={amountETH}
                    onChange={e => handleTAOInput(e.target.value)}
                    style={{ background:'none', border:'none', outline:'none', color:'var(--text)', fontSize:'1.5rem', fontWeight:500, width:'55%', padding:0 }} />
                  <div style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end', marginBottom:4 }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#00d4aa,#4ade80)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff' }}>τ</div>
                      <span style={{ fontWeight:600, fontSize:'0.92rem' }}>TAO</span>
                    </div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                      {address ? `${parseFloat(taoBalance).toFixed(4)} TAO` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Token input box */}
              <div style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <input type="number" placeholder="0" value={amountTok}
                    onChange={e => handleTokInput(e.target.value)}
                    style={{ background:'none', border:'none', outline:'none', color:'var(--text)', fontSize:'1.5rem', fontWeight:500, width:'55%', padding:0 }} />
                  <div style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end', marginBottom:4 }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', background:'rgba(59,130,246,0.25)', border:'1.5px solid #3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#60a5fa' }}>
                        {otherMeta?.symbol?.slice(0,2)}
                      </div>
                      <span style={{ fontWeight:600, fontSize:'0.92rem' }}>{otherMeta?.symbol}</span>
                    </div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                      {address ? `${parseFloat(tokBalance).toFixed(4)} ${otherMeta?.symbol}` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <button className="btn-bridge" style={{ padding:'14px 0', width:'100%', fontSize:'0.9rem' }}
                onClick={handleAdd} disabled={loading || !signer || !hasAmount}>
                {!signer
                  ? 'Connect Wallet'
                  : loading
                    ? <><div className="spinner" />Working...</>
                    : hasAmount ? 'Add Liquidity' : 'Enter an amount'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontWeight:600, fontSize:'0.92rem', marginBottom:4 }}>Remove liquidity</div>
              <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:10 }}>
                My LP: <span style={{ color:'var(--text)' }}>{parseFloat(lpBalance).toFixed(6)}</span>
              </div>
              <label style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Remove %</label>
              <input className="amount-input" style={{ width:'100%', marginBottom:10, marginTop:4 }}
                type="number" min="1" max="100" value={removePct}
                onChange={e => setRemovePct(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))} />
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:14 }}>
                Removing: {(parseFloat(lpBalance) * removePct / 100).toFixed(6)} LP
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
          Non-TAO pairs: use the contract directly or a future UI update.
        </div>
      )}
    </div>
  );
}

export default function Pools({ address, signer, chainId, connect, switchChain }) {
  const { pairs, loading, error, fetchPairs } = usePools();
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenA, setNewTokenA]   = useState('');
  const [newTokenB, setNewTokenB]   = useState(DEX_CONTRACTS.WTAO);
  const [creating,  setCreating]    = useState(false);
  const [createTx,  setCreateTx]    = useState(null);

  const isOnBittensor = chainId === 964;

  const handleCreatePool = async () => {
    if (!signer) { connect(); return; }
    if (!isOnBittensor) { switchChain(964); return; }
    if (!newTokenA || !newTokenB) return;
    setCreating(true); setCreateTx(null);
    try {
      const FACTORY_ABI = ['function createPair(address tokenA, address tokenB) external returns (address pair)'];
      const factory = new ethers.Contract(DEX_CONTRACTS.UniswapV2Factory, FACTORY_ABI, signer);
      const tx = await factory.createPair(newTokenA, newTokenB);
      setCreateTx(tx.hash);
      await tx.wait();
      setNewTokenA('');
      fetchPairs();
    } catch (e) {
      alert(e?.shortMessage || e?.message || 'Create pool failed');
    }
    setCreating(false);
  };

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1 className="page-title">Liquidity Pools</h1>
        <p className="page-sub">Provide liquidity and earn 0.3% on every swap</p>
      </div>

      <div className="page-content">
        {/* Header actions */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:'0.9rem', color:'var(--text-muted)' }}>
            {loading ? 'Loading pools...' : `${pairs.length} pool${pairs.length !== 1 ? 's' : ''} found`}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="dir-tab" onClick={fetchPairs} style={{ padding:'8px 14px', fontSize:'0.82rem' }}>
              Refresh
            </button>
            <button className={`dir-tab ${showCreate ? 'active' : ''}`}
              onClick={() => setShowCreate(s => !s)} style={{ padding:'8px 14px', fontSize:'0.82rem' }}>
              + Create Pool
            </button>
          </div>
        </div>

        {/* Create pool panel */}
        {showCreate && (
          <div className="bridge-card" style={{ marginBottom:20, padding:'18px 22px' }}>
            <div className="card-title" style={{ marginBottom:18, fontSize:'0.95rem' }}>Create New Pool</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:18 }}>
              <TokenPicker label="Token A" value={newTokenA} onChange={setNewTokenA} />
              <TokenPicker label="Token B" value={newTokenB} onChange={setNewTokenB} />
            </div>
            <button className="btn-bridge" style={{ padding:'11px 0', width:'100%' }}
              onClick={handleCreatePool} disabled={creating}>
              {creating ? <><div className="spinner" />Creating...</> : 'Create Pool'}
            </button>
            {createTx && (
              <div style={{ marginTop:10, textAlign:'center' }}>
                <a className="tx-link" href={`https://evm.taostats.io/tx/${createTx}`} target="_blank" rel="noreferrer">
                  Pool created! {createTx.slice(0,10)}... ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* Pools list */}
        {error && (
          <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'var(--radius-sm)', padding:'12px 16px', color:'var(--red)', marginBottom:16 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
            <div className="spinner" style={{ margin:'0 auto 12px', borderColor:'rgba(0,212,170,0.2)', borderTopColor:'#00d4aa' }} />
            Loading pools...
          </div>
        )}

        {!loading && pairs.length === 0 && (
          <div className="bridge-card" style={{ textAlign:'center', padding:'48px 24px' }}>
            <div style={{ fontSize:'2rem', marginBottom:12 }}>🌊</div>
            <div style={{ fontWeight:600, marginBottom:6 }}>No pools yet</div>
            <div style={{ color:'var(--text-muted)', fontSize:'0.88rem' }}>
              Be the first to create a liquidity pool on TAOflow DEX.
            </div>
          </div>
        )}

        {!loading && pairs.map(pair => (
          <PoolRow key={pair.address} pair={pair} address={address} signer={signer} onRefresh={fetchPairs} />
        ))}

        {/* Info card */}
        <div className="bridge-card" style={{ marginTop:24, padding:'18px 22px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, textAlign:'center' }}>
            <div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>Swap fee</div>
              <div style={{ fontWeight:700, color:'var(--cyan)' }}>0.3%</div>
            </div>
            <div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>Protocol fee</div>
              <div style={{ fontWeight:700 }}>0%</div>
            </div>
            <div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>Pair contract</div>
              <div style={{ fontWeight:700, fontSize:'0.75rem', color:'var(--text-sub)', fontFamily:'monospace' }}>
                {DEX_CONTRACTS.UniswapV2Factory.slice(0,10)}...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

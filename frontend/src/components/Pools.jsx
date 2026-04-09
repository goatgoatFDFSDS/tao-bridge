import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePools } from '../hooks/usePools';
import { DEX_CONTRACTS, ERC20_ABI } from '../hooks/useSwap';

const BITTENSOR_RPC = 'https://lite.chain.opentensor.ai';

function PoolRow({ pair, address, signer, onRefresh }) {
  const { addLiquidityETH, removeLiquidityETH, PAIR_ABI } = usePools();
  const [expanded, setExpanded]     = useState(false);
  const [lpBalance, setLpBalance]   = useState('0');
  const [amountETH, setAmountETH]   = useState('');
  const [amountTok, setAmountTok]   = useState('');
  const [removePct, setRemovePct]   = useState(100);
  const [loading,   setLoading]     = useState(false);
  const [txHash,    setTxHash]      = useState(null);

  const isWTAOPair = pair.token0.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase()
                  || pair.token1.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase();
  const otherToken = isWTAOPair
    ? (pair.token0.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase() ? pair.token1 : pair.token0)
    : null;
  const otherMeta  = isWTAOPair
    ? (pair.token0.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase() ? pair.meta1 : pair.meta0)
    : null;

  useEffect(() => {
    if (!address) return;
    const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
    const pair_ = new ethers.Contract(pair.address, PAIR_ABI, provider);
    pair_.balanceOf(address).then(b => setLpBalance(ethers.formatEther(b))).catch(() => {});
  }, [address, pair.address, PAIR_ABI]);

  const r0f = ethers.formatUnits(pair.reserve0, pair.meta0.decimals);
  const r1f = ethers.formatUnits(pair.reserve1, pair.meta1.decimals);

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

  return (
    <div className="pool-row">
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
            <div style={{ fontWeight:700, fontSize:'0.95rem' }}>
              {pair.meta0.symbol}/{pair.meta1.symbol}
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
              {pair.address.slice(0,8)}...{pair.address.slice(-6)}
            </div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'0.82rem', color:'var(--text-sub)' }}>Reserves</div>
          <div style={{ fontSize:'0.88rem' }}>
            {parseFloat(r0f).toFixed(4)} / {parseFloat(r1f).toFixed(4)}
          </div>
        </div>
        {address && (
          <div style={{ textAlign:'right', minWidth:80 }}>
            <div style={{ fontSize:'0.82rem', color:'var(--text-sub)' }}>My LP</div>
            <div style={{ fontSize:'0.88rem', color:'var(--cyan)' }}>
              {parseFloat(lpBalance).toFixed(6)}
            </div>
          </div>
        )}
        <div style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && isWTAOPair && (
        <div className="pool-expand">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Add Liquidity */}
            <div>
              <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:10, color:'var(--cyan)' }}>Add Liquidity</div>
              <label style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>TAO amount</label>
              <input className="amount-input" style={{ width:'100%', marginBottom:8, marginTop:4 }} type="number" placeholder="0.0"
                value={amountETH} onChange={e => setAmountETH(e.target.value)} />
              <label style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{otherMeta?.symbol} amount</label>
              <input className="amount-input" style={{ width:'100%', marginBottom:12, marginTop:4 }} type="number" placeholder="0.0"
                value={amountTok} onChange={e => setAmountTok(e.target.value)} />
              <button className="btn-bridge" style={{ padding:'10px 0', width:'100%' }} onClick={handleAdd} disabled={loading || !signer}>
                {loading ? <><div className="spinner" />Working...</> : 'Add Liquidity'}
              </button>
            </div>
            {/* Remove Liquidity */}
            <div>
              <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:10, color:'var(--red)' }}>Remove Liquidity</div>
              <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:6 }}>
                My LP: <span style={{ color:'var(--text)' }}>{parseFloat(lpBalance).toFixed(6)}</span>
              </div>
              <label style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Remove %</label>
              <input className="amount-input" style={{ width:'100%', marginBottom:12, marginTop:4 }} type="number" min="1" max="100"
                value={removePct} onChange={e => setRemovePct(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))} />
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:10 }}>
                Removing: {(parseFloat(lpBalance) * removePct / 100).toFixed(6)} LP
              </div>
              <button className="btn-bridge" style={{ padding:'10px 0', width:'100%', background:'linear-gradient(90deg, #f87171, #ef4444)' }}
                onClick={handleRemove} disabled={loading || !signer || parseFloat(lpBalance) <= 0}>
                {loading ? <><div className="spinner" />Working...</> : 'Remove Liquidity'}
              </button>
            </div>
          </div>
          {txHash && (
            <div style={{ marginTop:10, textAlign:'center' }}>
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

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px' }}>
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
            <div className="card-title" style={{ marginBottom:14, fontSize:'0.95rem' }}>Create New Pool</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:'0.78rem', color:'var(--text-muted)', display:'block', marginBottom:4 }}>Token A address</label>
                <input className="recipient-input" placeholder="0x..." value={newTokenA} onChange={e => setNewTokenA(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:'0.78rem', color:'var(--text-muted)', display:'block', marginBottom:4 }}>Token B address</label>
                <input className="recipient-input" placeholder="0x..." value={newTokenB} onChange={e => setNewTokenB(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:12 }}>
              WTAO: <span style={{ color:'var(--text-sub)', fontFamily:'monospace' }}>{DEX_CONTRACTS.WTAO}</span>
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

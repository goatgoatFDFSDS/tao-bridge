import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';
import { ethers } from 'ethers';
import { DEX_CONTRACTS } from '../hooks/useSwap';

const RPC = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';
const BLOCK_TIME = 12; // ~12s per block on Bittensor EVM

const TOKENS = [
  { symbol: 'TFLOW', address: DEX_CONTRACTS.TFLOW, color: '#3b82f6', decimals: 18 },
];

const TIMEFRAMES = [
  { label: '1m',  seconds: 60,    blocks: 1500  },
  { label: '5m',  seconds: 300,   blocks: 3000  },
  { label: '15m', seconds: 900,   blocks: 5000  },
  { label: '1H',  seconds: 3600,  blocks: 10000 },
  { label: '4H',  seconds: 14400, blocks: 20000 },
  { label: '1D',  seconds: 86400, blocks: 50000 },
];

const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
const PAIR_ABI = [
  'function token0() view returns (address)',
  'event Sync(uint112 reserve0, uint112 reserve1)',
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
];

function timeAgo(ts) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtPrice(p) {
  if (!p || p === 0) return '—';
  if (p < 0.000001) return p.toFixed(10);
  if (p < 0.001) return p.toFixed(8);
  if (p < 1) return p.toFixed(6);
  return p.toFixed(4);
}

function fmtAmount(v, decimals = 18) {
  const n = parseFloat(ethers.formatUnits(v, decimals));
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  return n.toFixed(4);
}

export default function Chart() {
  const [token,     setToken]     = useState(TOKENS[0]);
  const [tf,        setTf]        = useState(TIMEFRAMES[1]); // 5m default
  const [price,     setPrice]     = useState(null);
  const [change,    setChange]    = useState(null);
  const [mcap,      setMcap]      = useState(null);
  const [trades,    setTrades]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [pairAddr,  setPairAddr]  = useState(null);
  const [token0,    setToken0]    = useState(null);

  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const seriesRef = useRef(null);

  // Init/resize chart
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(255,255,255,0.4)',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        textColor: 'rgba(255,255,255,0.4)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: token.color,
      topColor: token.color + '40',
      bottomColor: token.color + '00',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 10, minMove: 0.0000000001 },
    });

    chartInst.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: chartRef.current?.clientWidth });
    });
    ro.observe(chartRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [token.color]);

  // Fetch pair + data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      const factory = new ethers.Contract(DEX_CONTRACTS.UniswapV2Factory, FACTORY_ABI, provider);
      const pair = await factory.getPair(DEX_CONTRACTS.WTAO, token.address);
      if (pair === ethers.ZeroAddress) { setLoading(false); return; }

      setPairAddr(pair);
      const pairC = new ethers.Contract(pair, PAIR_ABI, provider);
      const t0 = await pairC.token0();
      setToken0(t0);

      const taoIsToken0 = t0.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase();

      // Current block & timestamp
      const currentBlock = await provider.getBlockNumber();
      const currentTs    = Math.floor(Date.now() / 1000);
      const fromBlock    = Math.max(0, currentBlock - tf.blocks);

      // ── Sync events → price history ─────────────────────────────────
      const syncEvents = await pairC.queryFilter('Sync', fromBlock, currentBlock).catch(() => []);

      const rawPoints = syncEvents.map(ev => {
        const r0 = ev.args[0]; // reserve0
        const r1 = ev.args[1]; // reserve1
        const blockAge = currentBlock - ev.blockNumber;
        const ts = currentTs - blockAge * BLOCK_TIME;

        const taoReserve = taoIsToken0 ? r0 : r1;
        const tokReserve = taoIsToken0 ? r1 : r0;

        const taoF = parseFloat(ethers.formatEther(taoReserve));
        const tokF = parseFloat(ethers.formatUnits(tokReserve, token.decimals));
        const priceVal = tokF > 0 ? taoF / tokF : 0;

        return { time: ts, value: priceVal, block: ev.blockNumber };
      }).filter(p => p.value > 0);

      // Group into timeframe buckets — use last price in each bucket
      const bucketSec = tf.seconds;
      const bucketMap = new Map();
      for (const p of rawPoints) {
        const bucket = Math.floor(p.time / bucketSec) * bucketSec;
        bucketMap.set(bucket, p.value);
      }

      const chartData = [...bucketMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time, value }));

      if (seriesRef.current && chartData.length > 0) {
        seriesRef.current.applyOptions({
          lineColor: token.color,
          topColor: token.color + '40',
          bottomColor: token.color + '00',
        });
        seriesRef.current.setData(chartData);
        chartInst.current?.timeScale().fitContent();
      }

      // Current price from last sync
      if (chartData.length > 0) {
        const currentPrice = chartData[chartData.length - 1].value;
        const oldPrice = chartData[0].value;
        setPrice(currentPrice);
        setChange(oldPrice > 0 ? ((currentPrice - oldPrice) / oldPrice) * 100 : 0);
        // MCap estimate: totalSupply * price (approx 1B tokens for TEST, use price * 1M for TFLOW)
        setMcap(currentPrice * 1_000_000_000);
      }

      // ── Swap events → trade history ──────────────────────────────────
      const swapEvents = await pairC.queryFilter('Swap', Math.max(0, currentBlock - 5000), currentBlock).catch(() => []);

      const tradeList = swapEvents.map(ev => {
        const { amount0In, amount1In, amount0Out, amount1Out, to } = ev.args;
        const blockAge = currentBlock - ev.blockNumber;
        const ts = currentTs - blockAge * BLOCK_TIME;

        let isBuy, taoAmt, tokAmt;
        if (taoIsToken0) {
          // token0=WTAO, token1=TOKEN
          isBuy = amount0In > 0n; // TAO in → buying TOKEN
          taoAmt = isBuy ? amount0In : amount1Out;
          tokAmt = isBuy ? amount1Out : amount1In;
        } else {
          // token0=TOKEN, token1=WTAO
          isBuy = amount1In > 0n; // TAO (token1) in → buying TOKEN
          taoAmt = isBuy ? amount1In : amount0Out;
          tokAmt = isBuy ? amount0Out : amount0In;
        }

        return {
          isBuy,
          wallet: to,
          taoAmt: parseFloat(ethers.formatEther(taoAmt)).toFixed(4),
          tokAmt: fmtAmount(tokAmt, token.decimals),
          ts,
          txHash: ev.transactionHash,
        };
      }).reverse(); // most recent first

      setTrades(tradeList.slice(0, 50));
    } catch (e) {
      console.error('Chart fetch error:', e);
    }
    setLoading(false);
  }, [token, tf]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const changeColor = change === null ? 'var(--text-muted)' : change >= 0 ? '#4ade80' : '#f87171';

  return (
    <div className="page-wrap" style={{ padding:0, minHeight:'100vh' }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 20px', borderBottom:'1px solid var(--border)',
        background:'var(--bg-card)', flexWrap:'wrap', gap:10,
      }}>
        {/* Token selector */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {TOKENS.map(t => (
            <button key={t.symbol}
              onClick={() => setToken(t)}
              style={{
                display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
                borderRadius:8, border:`1.5px solid ${token.symbol === t.symbol ? t.color : 'var(--border)'}`,
                background: token.symbol === t.symbol ? t.color + '22' : 'var(--bg-input)',
                cursor:'pointer', color: token.symbol === t.symbol ? t.color : 'var(--text-sub)',
                fontWeight:700, fontSize:'0.88rem',
              }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:t.color, flexShrink:0 }} />
              ${t.symbol}
            </button>
          ))}
        </div>

        {/* Price info */}
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
            Price{' '}
            <span style={{ color:'var(--text)', fontWeight:600, fontFamily:'monospace' }}>
              {price ? fmtPrice(price) : '—'}
            </span>
            {' '}<span style={{ color:'var(--text-muted)' }}>TAO</span>
          </div>
          {change !== null && (
            <div style={{ fontSize:'0.8rem', fontWeight:700, color: changeColor }}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </div>
          )}
          {mcap && (
            <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
              MCap{' '}
              <span style={{ color:'var(--text)', fontWeight:600 }}>
                {mcap >= 1e9 ? (mcap/1e9).toFixed(2)+'B' : mcap >= 1e6 ? (mcap/1e6).toFixed(2)+'M' : (mcap/1e3).toFixed(2)+'K'}
              </span>
            </div>
          )}
          {pairAddr && (
            <a href={`https://evm.taostats.io/address/${pairAddr}`} target="_blank" rel="noreferrer"
              style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontFamily:'monospace', textDecoration:'none' }}>
              {pairAddr.slice(0,8)}...
            </a>
          )}
        </div>
      </div>

      {/* ── Timeframe buttons ────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:2, padding:'8px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg-card)' }}>
        {TIMEFRAMES.map(t => (
          <button key={t.label}
            onClick={() => setTf(t)}
            style={{
              padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer',
              background: tf.label === t.label ? 'rgba(0,212,170,0.15)' : 'transparent',
              color: tf.label === t.label ? 'var(--cyan)' : 'var(--text-muted)',
              fontWeight: tf.label === t.label ? 700 : 400,
              fontSize:'0.82rem',
            }}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:'0.8rem', color: change !== null ? changeColor : 'var(--text-muted)', fontWeight:700 }}>
          {price ? fmtPrice(price) : '—'}
          {change !== null && <span style={{ marginLeft:8 }}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>}
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div style={{ position:'relative', background:'#050d1a' }}>
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, background:'rgba(5,13,26,0.7)' }}>
            <div className="spinner" style={{ borderColor:'rgba(0,212,170,0.2)', borderTopColor:'#00d4aa' }} />
          </div>
        )}
        <div ref={chartRef} style={{ width:'100%', height:400 }} />
      </div>

      {/* ── Trade history ────────────────────────────────────────────────── */}
      <div style={{ padding:'0 20px 40px', maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 0 10px' }}>
          <div style={{ fontWeight:700, fontSize:'0.9rem' }}>Trades</div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>last 5000 blocks · auto-refresh 30s</div>
        </div>

        {/* Table header */}
        <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 80px', gap:8, padding:'6px 10px', fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', borderBottom:'1px solid var(--border)' }}>
          <div>Type</div>
          <div>Wallet</div>
          <div>TAO</div>
          <div>{token.symbol}</div>
          <div style={{ textAlign:'right' }}>Age</div>
        </div>

        {trades.length === 0 && !loading && (
          <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'0.88rem' }}>
            No trades found in this block range
          </div>
        )}

        {trades.map((t, i) => (
          <a key={i} href={`https://evm.taostats.io/tx/${t.txHash}`} target="_blank" rel="noreferrer"
            style={{
              display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 80px', gap:8,
              padding:'8px 10px', textDecoration:'none', color:'inherit',
              borderBottom:'1px solid rgba(255,255,255,0.04)',
              transition:'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div>
              <span style={{
                fontSize:'0.72rem', fontWeight:700, padding:'2px 7px', borderRadius:4,
                background: t.isBuy ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                color: t.isBuy ? '#4ade80' : '#f87171',
                border: `1px solid ${t.isBuy ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              }}>
                {t.isBuy ? 'BUY' : 'SELL'}
              </span>
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'0.78rem', color:'var(--text-sub)' }}>
              {t.wallet.slice(0,6)}...{t.wallet.slice(-4)}
            </div>
            <div style={{ fontSize:'0.82rem', fontWeight:500 }}>{t.taoAmt}</div>
            <div style={{ fontSize:'0.82rem', color:'var(--text-sub)' }}>{t.tokAmt}</div>
            <div style={{ textAlign:'right', fontSize:'0.75rem', color:'var(--text-muted)' }}>{timeAgo(t.ts)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

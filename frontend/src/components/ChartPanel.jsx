import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';
import { ethers } from 'ethers';
import { DEX_CONTRACTS } from '../hooks/useSwap';

const RPC = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';
const BLOCK_TIME = 12;

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
  if (!p) return '—';
  if (p < 0.000001) return p.toFixed(10);
  if (p < 0.001) return p.toFixed(8);
  if (p < 1) return p.toFixed(6);
  return p.toFixed(4);
}

function fmtAmt(v, decimals = 18) {
  const n = parseFloat(ethers.formatUnits(v, decimals));
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  return n.toFixed(4);
}

// token = { symbol, address, decimals, color }
export default function ChartPanel({ token }) {
  const [tf,      setTf]      = useState(TIMEFRAMES[1]);
  const [price,   setPrice]   = useState(null);
  const [change,  setChange]  = useState(null);
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(true);

  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const seriesRef = useRef(null);
  const tokenRef  = useRef(token);

  const color = token?.color || '#00d4aa';

  // Init chart once
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { color: 'transparent' }, textColor: 'rgba(255,255,255,0.35)', fontFamily: 'Inter,sans-serif' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.07)', textColor: 'rgba(255,255,255,0.35)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.07)', timeVisible: true, secondsVisible: false },
      handleScroll: true, handleScale: true,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: color, topColor: color + '35', bottomColor: color + '00', lineWidth: 2,
      priceFormat: { type: 'price', precision: 10, minMove: 0.0000000001 },
    });
    chartInst.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []); // only once

  // Update series color when token changes
  useEffect(() => {
    tokenRef.current = token;
    seriesRef.current?.applyOptions({ lineColor: color, topColor: color + '35', bottomColor: color + '00' });
  }, [token, color]);

  const fetchData = useCallback(async () => {
    const tok = tokenRef.current;
    if (!tok || tok.isNative) { setLoading(false); return; }
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      const factory = new ethers.Contract(DEX_CONTRACTS.UniswapV2Factory, FACTORY_ABI, provider);
      const pairAddr = await factory.getPair(DEX_CONTRACTS.WTAO, tok.address);
      if (pairAddr === ethers.ZeroAddress) { setLoading(false); return; }

      const pairC = new ethers.Contract(pairAddr, PAIR_ABI, provider);
      const t0 = await pairC.token0();
      const taoIsToken0 = t0.toLowerCase() === DEX_CONTRACTS.WTAO.toLowerCase();

      const currentBlock = await provider.getBlockNumber();
      const currentTs    = Math.floor(Date.now() / 1000);
      const fromBlock    = Math.max(0, currentBlock - tf.blocks);

      // Price history from Sync events
      const syncEvents = await pairC.queryFilter('Sync', fromBlock, currentBlock).catch(() => []);
      const rawPoints = syncEvents.map(ev => {
        const r0 = ev.args[0], r1 = ev.args[1];
        const ts = currentTs - (currentBlock - ev.blockNumber) * BLOCK_TIME;
        const taoF = parseFloat(ethers.formatEther(taoIsToken0 ? r0 : r1));
        const tokF = parseFloat(ethers.formatUnits(taoIsToken0 ? r1 : r0, tok.decimals));
        return { time: ts, value: tokF > 0 ? taoF / tokF : 0 };
      }).filter(p => p.value > 0);

      const bucketMap = new Map();
      for (const p of rawPoints) {
        const b = Math.floor(p.time / tf.seconds) * tf.seconds;
        bucketMap.set(b, p.value);
      }
      const chartData = [...bucketMap.entries()].sort((a,b) => a[0]-b[0]).map(([time,value]) => ({ time, value }));

      if (seriesRef.current && chartData.length > 0) {
        seriesRef.current.setData(chartData);
        chartInst.current?.timeScale().fitContent();
        const cur = chartData[chartData.length - 1].value;
        const old = chartData[0].value;
        setPrice(cur);
        setChange(old > 0 ? ((cur - old) / old) * 100 : 0);
      }

      // Trade history
      const swapEvents = await pairC.queryFilter('Swap', Math.max(0, currentBlock - 3000), currentBlock).catch(() => []);
      const tradeList = swapEvents.map(ev => {
        const { amount0In, amount1In, amount0Out, amount1Out, to } = ev.args;
        const ts = currentTs - (currentBlock - ev.blockNumber) * BLOCK_TIME;
        let isBuy, taoAmt, tokAmt;
        if (taoIsToken0) {
          isBuy = amount0In > 0n;
          taoAmt = isBuy ? amount0In : amount1Out;
          tokAmt = isBuy ? amount1Out : amount1In;
        } else {
          isBuy = amount1In > 0n;
          taoAmt = isBuy ? amount1In : amount0Out;
          tokAmt = isBuy ? amount0Out : amount0In;
        }
        return { isBuy, wallet: to, taoAmt: parseFloat(ethers.formatEther(taoAmt)).toFixed(4), tokAmt: fmtAmt(tokAmt, tok.decimals), ts, txHash: ev.transactionHash };
      }).reverse().slice(0, 30);
      setTrades(tradeList);
    } catch {}
    setLoading(false);
  }, [tf]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const chgColor = change === null ? 'var(--text-muted)' : change >= 0 ? '#4ade80' : '#f87171';
  const isNative = token?.isNative;

  if (isNative) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)', fontSize:'0.9rem' }}>
      Select a token to view chart
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-card)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
          <span style={{ fontWeight:700, fontSize:'0.95rem' }}>${token?.symbol}</span>
          <span style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>/TAO</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:'0.9rem' }}>{fmtPrice(price)}</span>
          {change !== null && (
            <span style={{ fontSize:'0.82rem', fontWeight:700, color: chgColor }}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Timeframes */}
      <div style={{ display:'flex', gap:2, padding:'6px 12px', borderBottom:'1px solid var(--border)' }}>
        {TIMEFRAMES.map(t => (
          <button key={t.label} onClick={() => setTf(t)}
            style={{ padding:'3px 8px', borderRadius:5, border:'none', cursor:'pointer', fontSize:'0.78rem',
              background: tf.label === t.label ? 'rgba(0,212,170,0.15)' : 'transparent',
              color: tf.label === t.label ? 'var(--cyan)' : 'var(--text-muted)',
              fontWeight: tf.label === t.label ? 700 : 400,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ position:'relative', background:'#050d1a' }}>
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5, background:'rgba(5,13,26,0.6)' }}>
            <div className="spinner" style={{ borderColor:'rgba(0,212,170,0.2)', borderTopColor:'#00d4aa' }} />
          </div>
        )}
        <div ref={chartRef} style={{ width:'100%', height:260 }} />
      </div>

      {/* Trade list */}
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'52px 1fr 80px 80px 50px', gap:4, padding:'6px 12px', fontSize:'0.68rem', color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', borderBottom:'1px solid rgba(255,255,255,0.05)', position:'sticky', top:0, background:'var(--bg-card)' }}>
          <div>Type</div><div>Wallet</div><div>TAO</div><div>{token?.symbol}</div><div style={{ textAlign:'right' }}>Age</div>
        </div>
        {trades.length === 0 && !loading && (
          <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:'0.82rem' }}>No recent trades</div>
        )}
        {trades.map((t, i) => (
          <a key={i} href={`https://evm.taostats.io/tx/${t.txHash}`} target="_blank" rel="noreferrer"
            style={{ display:'grid', gridTemplateColumns:'52px 1fr 80px 80px 50px', gap:4, padding:'6px 12px', textDecoration:'none', color:'inherit', borderBottom:'1px solid rgba(255,255,255,0.03)', transition:'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div>
              <span style={{ fontSize:'0.68rem', fontWeight:700, padding:'2px 5px', borderRadius:3,
                background: t.isBuy ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                color: t.isBuy ? '#4ade80' : '#f87171',
                border: `1px solid ${t.isBuy ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'}`,
              }}>{t.isBuy ? 'BUY' : 'SELL'}</span>
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'0.75rem', color:'var(--text-sub)' }}>{t.wallet.slice(0,6)}...{t.wallet.slice(-4)}</div>
            <div style={{ fontSize:'0.78rem' }}>{t.taoAmt}</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-sub)' }}>{t.tokAmt}</div>
            <div style={{ textAlign:'right', fontSize:'0.72rem', color:'var(--text-muted)' }}>{timeAgo(t.ts)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

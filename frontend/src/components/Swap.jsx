import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useSwap, DEX_CONTRACTS, ERC20_ABI } from '../hooks/useSwap';

const BITTENSOR_RPC = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';

// Well-known tokens on Bittensor EVM (chain 964)
const KNOWN_TOKENS = [
  { symbol: 'TAO',   address: 'TAO',              decimals: 18, isNative: true },
  { symbol: 'TFLOW', address: DEX_CONTRACTS.TFLOW, decimals: 18 },
];

function TokenIcon({ symbol, size = 22 }) {
  const colors = { TAO: '#00d4aa', WTAO: '#00d4aa' };
  const color = colors[symbol] || '#3b82f6';
  return (
    <svg width={size} height={size} viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="11" fill={color} opacity="0.18" />
      <circle cx="11" cy="11" r="10" fill="none" stroke={color} strokeWidth="1.2" />
      <text x="11" y="15" textAnchor="middle" fill={color}
        fontSize="7.5" fontWeight="700" fontFamily="Inter,sans-serif">
        {symbol?.slice(0, 3)}
      </text>
    </svg>
  );
}

export default function Swap({ address, signer, chainId, connect, switchChain }) {
  const { status, txHash, error, getAmountsOut, swap, reset, ROUTER_ABI } = useSwap(signer);

  const [tokenIn,      setTokenIn]      = useState(KNOWN_TOKENS[0]);
  const [tokenOut,     setTokenOut]     = useState(KNOWN_TOKENS[1]);
  const [amountIn,     setAmountIn]     = useState('');
  const [amountOut,    setAmountOut]    = useState('');
  const [slippage,     setSlippage]     = useState(50);  // bps
  const [showSettings, setShowSettings] = useState(false);
  const [customSlip,   setCustomSlip]   = useState('');
  const [balanceIn,    setBalanceIn]    = useState('0');
  const [balanceOut,   setBalanceOut]   = useState('0');
  const [quoting,      setQuoting]      = useState(false);
  const [customToken,  setCustomToken]  = useState('');
  const [customTokenMeta, setCustomTokenMeta] = useState(null);
  const [showCustom,   setShowCustom]   = useState(false);
  const [toast,        setToast]        = useState(null);
  const quoteTimer = useRef(null);

  const isOnBittensor = chainId === 964;

  // Fetch balances
  const fetchBalance = useCallback(async (token, userAddress) => {
    if (!userAddress) return '0';
    const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
    try {
      if (token.isNative) {
        const bal = await provider.getBalance(userAddress);
        return ethers.formatEther(bal);
      }
      const c = new ethers.Contract(token.address, ERC20_ABI, provider);
      const [bal, dec] = await Promise.all([c.balanceOf(userAddress), c.decimals()]);
      return ethers.formatUnits(bal, dec);
    } catch { return '0'; }
  }, []);

  useEffect(() => {
    if (!address) return;
    fetchBalance(tokenIn,  address).then(setBalanceIn);
    fetchBalance(tokenOut, address).then(setBalanceOut);
  }, [address, tokenIn, tokenOut, fetchBalance, status]);

  // Auto-quote when amountIn changes
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    if (!amountIn || parseFloat(amountIn) <= 0) { setAmountOut(''); return; }

    quoteTimer.current = setTimeout(async () => {
      setQuoting(true);
      try {
        const decimalsIn = tokenIn.decimals || 18;
        const raw = ethers.parseUnits(amountIn, decimalsIn);
        const inAddr  = tokenIn.isNative  ? DEX_CONTRACTS.WTAO : tokenIn.address;
        const outAddr = tokenOut.isNative ? DEX_CONTRACTS.WTAO : tokenOut.address;
        if (inAddr === outAddr) { setAmountOut(amountIn); setQuoting(false); return; }
        const amounts = await getAmountsOut(raw, [inAddr, outAddr]);
        if (amounts && amounts[1] != null) {
          const decimalsOut = tokenOut.decimals || 18;
          setAmountOut(ethers.formatUnits(amounts[1], decimalsOut));
        } else {
          setAmountOut('');
        }
      } catch { setAmountOut(''); }
      setQuoting(false);
    }, 400);

    return () => clearTimeout(quoteTimer.current);
  }, [amountIn, tokenIn, tokenOut, getAmountsOut]);

  const handleFlip = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(amountOut);
    setAmountOut(amountIn);
  };

  const handleSwap = async () => {
    if (!address) { connect(); return; }
    if (!isOnBittensor) { switchChain(964); return; }
    if (!amountIn || parseFloat(amountIn) <= 0) return;
    if (!amountOut || parseFloat(amountOut) <= 0) return;
    reset();
    try {
      const decimalsIn  = tokenIn.decimals  || 18;
      const decimalsOut = tokenOut.decimals || 18;
      const rawIn  = ethers.parseUnits(amountIn,  decimalsIn);
      const rawOut = ethers.parseUnits(amountOut, decimalsOut);
      const inAddr  = tokenIn.isNative  ? 'TAO' : tokenIn.address;
      const outAddr = tokenOut.isNative ? 'TAO' : tokenOut.address;
      await swap({ tokenIn: inAddr, tokenOut: outAddr, amountIn: rawIn, amountOutMin: rawOut, slippage, to: address });
      setToast({ msg: 'Swap successful!', type: 'success' });
      setAmountIn('');
      setAmountOut('');
    } catch (e) {
      setToast({ msg: e?.shortMessage || e?.message || 'Swap failed', type: 'error' });
    }
  };

  const handleAddCustomToken = async () => {
    if (!customToken || !customToken.startsWith('0x')) return;
    try {
      const provider = new ethers.JsonRpcProvider(BITTENSOR_RPC);
      const c = new ethers.Contract(customToken, ERC20_ABI, provider);
      const [sym, dec] = await Promise.all([c.symbol(), c.decimals()]);
      const meta = { symbol: sym, address: customToken, decimals: Number(dec) };
      setCustomTokenMeta(meta);
    } catch {
      setToast({ msg: 'Could not fetch token info. Is this a valid ERC20?', type: 'error' });
    }
  };

  const addCustomAsTokenIn = () => {
    if (!customTokenMeta) return;
    setTokenIn(customTokenMeta);
    setShowCustom(false);
    setCustomToken('');
    setCustomTokenMeta(null);
  };
  const addCustomAsTokenOut = () => {
    if (!customTokenMeta) return;
    setTokenOut(customTokenMeta);
    setShowCustom(false);
    setCustomToken('');
    setCustomTokenMeta(null);
  };

  const allTokens = customTokenMeta
    ? [...KNOWN_TOKENS, customTokenMeta]
    : KNOWN_TOKENS;

  const btnLabel = () => {
    if (!address) return 'Connect Wallet';
    if (!isOnBittensor) return 'Switch to Bittensor EVM';
    if (status === 'approving') return 'Approving...';
    if (status === 'swapping')  return 'Swapping...';
    if (!amountIn || parseFloat(amountIn) <= 0) return 'Enter amount';
    if (!amountOut) return 'No liquidity for this pair';
    return `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`;
  };

  const btnDisabled = !!address && isOnBittensor && (
    status === 'approving' || status === 'swapping' ||
    !amountIn || parseFloat(amountIn) <= 0 || !amountOut
  );

  const slippageLabel = slippage === 10 ? '0.1%' : slippage === 50 ? '0.5%' : slippage === 100 ? '1%' : `${(slippage / 100).toFixed(2)}%`;

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="page-wrap">
      <div className="page-hero">
        <h1 className="page-title">Swap</h1>
        <p className="page-sub">Instant token swaps on Bittensor EVM via TAOflow DEX</p>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`} onClick={() => setToast(null)} style={{ position:'fixed', top:80, right:24, zIndex:9999 }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="swap-wrap">
        <div className="bridge-card" style={{ maxWidth: 440 }}>
          {/* Header */}
          <div className="card-header">
            <span className="card-title">Swap Tokens</span>
            <button className="card-settings" onClick={() => setShowSettings(s => !s)} title="Slippage settings">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>

          {/* Slippage panel */}
          {showSettings && (
            <div className="slippage-panel">
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:8 }}>Max slippage</div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                {[10, 50, 100].map(v => (
                  <button key={v} className={`slip-btn ${slippage === v && !customSlip ? 'active' : ''}`}
                    onClick={() => { setSlippage(v); setCustomSlip(''); }}>
                    {v === 10 ? '0.1%' : v === 50 ? '0.5%' : '1%'}
                  </button>
                ))}
                <input className="slip-input" placeholder="Custom %" value={customSlip}
                  onChange={e => {
                    setCustomSlip(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setSlippage(Math.round(v * 100));
                  }} />
              </div>
            </div>
          )}

          {/* Token In */}
          <div className="section-label">You pay</div>
          <div className="from-block">
            <div className="chain-token-row">
              <select className="token-select" value={tokenIn.address}
                onChange={e => {
                  const t = allTokens.find(x => x.address === e.target.value);
                  if (t) setTokenIn(t);
                }}>
                {allTokens.map(t => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
            </div>
            <div className="amount-row">
              <input type="number" className="amount-input" placeholder="0.00"
                value={amountIn} min="0"
                onChange={e => setAmountIn(e.target.value)} />
            </div>
            <div className="balance-row">
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <TokenIcon symbol={tokenIn.symbol} size={16} />
                <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{tokenIn.symbol}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="balance-text">Balance: {parseFloat(balanceIn).toFixed(6)}</span>
                <button className="btn-max" onClick={() => setAmountIn(parseFloat(balanceIn).toFixed(8))}>MAX</button>
              </div>
            </div>
          </div>

          {/* Flip button */}
          <div className="arrow-wrap">
            <button className="arrow-btn" onClick={handleFlip} title="Flip tokens">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </button>
          </div>

          {/* Token Out */}
          <div className="section-label" style={{ marginTop:4 }}>You receive</div>
          <div className="to-block">
            <div className="chain-token-row">
              <select className="token-select" value={tokenOut.address}
                onChange={e => {
                  const t = allTokens.find(x => x.address === e.target.value);
                  if (t) setTokenOut(t);
                }}>
                {allTokens.map(t => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
            </div>
            <div className="amount-row">
              {quoting ? (
                <span style={{ color:'var(--text-muted)', fontSize:'1rem' }}>Quoting...</span>
              ) : (
                <span className="receive-amount">
                  {amountOut ? parseFloat(amountOut).toFixed(8) : '0.00000000'}
                  <span style={{ fontSize:'1rem', fontWeight:500, marginLeft:6 }}>{tokenOut.symbol}</span>
                </span>
              )}
            </div>
            <div className="balance-row">
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <TokenIcon symbol={tokenOut.symbol} size={16} />
                <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{tokenOut.symbol}</span>
              </div>
              <span className="balance-text">Balance: {parseFloat(balanceOut).toFixed(6)}</span>
            </div>
          </div>

          {/* Info rows */}
          {amountIn && amountOut && parseFloat(amountIn) > 0 && (
            <div className="bridge-info" style={{ marginTop:12 }}>
              <div className="info-row">
                <span>Rate</span>
                <span>1 {tokenIn.symbol} = {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} {tokenOut.symbol}</span>
              </div>
              <div className="info-row">
                <span>Max slippage</span>
                <span>{slippageLabel}</span>
              </div>
              <div className="info-row">
                <span>Fee</span>
                <span>0.3%</span>
              </div>
            </div>
          )}

          {/* TX hash */}
          {txHash && (
            <div style={{ margin:'10px 0', textAlign:'center' }}>
              <a className="tx-link"
                href={`https://evm.taostats.io/tx/${txHash}`}
                target="_blank" rel="noreferrer">
                {txHash.slice(0,10)}...{txHash.slice(-6)} ↗
              </a>
            </div>
          )}

          {/* CTA */}
          <button
            className={`btn-bridge ${status === 'approving' || status === 'swapping' ? 'loading' : ''}`}
            onClick={handleSwap}
            disabled={btnDisabled}>
            {(status === 'approving' || status === 'swapping') && <div className="spinner" />}
            {btnLabel()}
          </button>
        </div>

        {/* Custom token panel */}
        <div className="bridge-card" style={{ maxWidth: 440, padding:'18px 22px' }}>
          <div className="card-header" style={{ marginBottom:0 }}>
            <span className="card-title" style={{ fontSize:'0.95rem' }}>Add Custom Token</span>
            <button className="card-settings" onClick={() => setShowCustom(s => !s)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {showCustom
                  ? <path d="M18 6L6 18M6 6l12 12"/>
                  : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
              </svg>
            </button>
          </div>
          {showCustom && (
            <div style={{ marginTop:14 }}>
              <input className="recipient-input" placeholder="Token contract address (0x...)"
                value={customToken} onChange={e => setCustomToken(e.target.value)} />
              <button className="btn-bridge" style={{ marginTop:10, padding:'10px 0' }}
                onClick={handleAddCustomToken}>
                Look up token
              </button>
              {customTokenMeta && (
                <div style={{ marginTop:12, background:'var(--bg-input)', borderRadius:'var(--radius-sm)', padding:'12px 14px' }}>
                  <div style={{ color:'var(--text)', fontWeight:600, marginBottom:6 }}>
                    {customTokenMeta.name || customTokenMeta.symbol} ({customTokenMeta.symbol})
                  </div>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:10 }}>
                    {customTokenMeta.address}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="dir-tab active" style={{ flex:1, padding:'7px 0' }} onClick={addCustomAsTokenIn}>
                      Set as Token In
                    </button>
                    <button className="dir-tab active" style={{ flex:1, padding:'7px 0' }} onClick={addCustomAsTokenOut}>
                      Set as Token Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!showCustom && (
            <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:8 }}>
              Paste any ERC-20 contract address to add it to the token list.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react';

const CHAIN_COLORS = {
  Ethereum: '#627eea',
  Base:     '#0052ff',
  BSC:      '#f0b90b',
  Bittensor:'#00d4aa',
};

const CHAIN_ICONS = {
  Ethereum: 'E',
  Base:     'B',
  BSC:      'B',
  Bittensor:'τ',
};

function ChainDot({ name }) {
  const color = CHAIN_COLORS[name] || '#3b82f6';
  const label = CHAIN_ICONS[name] || '?';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%',
      fontSize: '0.6rem', fontWeight: 800,
      background: color + '22', color,
      border: `1px solid ${color}55`,
      flexShrink: 0,
    }}>{label}</span>
  );
}

function short(h) {
  return h ? `${h.slice(0, 6)}...${h.slice(-4)}` : '';
}

function timeAgo(blockNumber) {
  return `Block #${blockNumber.toLocaleString()}`;
}

function TxRow({ tx }) {
  const isIn  = tx.type === 'stable→tao';   // user sent stables, received TAO
  const color = isIn ? '#00d4aa' : '#3b82f6';
  const label = isIn ? 'Bridge In' : 'Bridge Out';
  const icon  = isIn ? '↓' : '↑';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '12px 14px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      transition: 'background 0.15s',
    }}>
      {/* Row 1: direction badge + chains + amount */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* Badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 20,
            fontSize: '0.7rem', fontWeight: 700,
            background: color + '18', color,
            border: `1px solid ${color}44`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.75rem' }}>{icon}</span>
            {label}
          </span>

          {/* Chain flow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <ChainDot name={tx.srcChain} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {tx.srcChain}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
            <ChainDot name={tx.destChain} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {tx.destChain}
            </span>
          </div>
        </div>

        {/* Amounts */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
            {isIn
              ? <>{tx.amount.toFixed(2)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{tx.token}</span></>
              : <>{tx.amount.toFixed(4)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>TAO</span></>
            }
          </div>
          <div style={{ fontSize: '0.7rem', color: color, marginTop: 1 }}>
            {isIn ? '→ TAO received' : `→ ${tx.token} received`}
          </div>
        </div>
      </div>

      {/* Row 2: tx hash + block */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          {timeAgo(tx.blockNumber)}
        </span>
        <a
          href={tx.explorerUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.7rem', color: 'var(--text-muted)',
            textDecoration: 'none',
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'color 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.color = color}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {short(tx.txHash)}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

export default function TxHistory({ txs, loading, address, refresh }) {
  const inTxs  = txs.filter(t => t.type === 'stable→tao');
  const outTxs = txs.filter(t => t.type === 'tao→stable');

  return (
    <section className="tx-history-section">
      <div className="tx-history-card">

        {/* Header */}
        <div className="tx-history-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cyan)' }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span className="tx-history-title">Transaction History</span>
            {txs.length > 0 && (
              <span style={{
                padding: '1px 7px', borderRadius: 20,
                fontSize: '0.68rem', fontWeight: 700,
                background: 'rgba(0,212,170,0.12)', color: 'var(--cyan)',
              }}>{txs.length}</span>
            )}
          </div>
          <button className="tx-refresh-btn" onClick={refresh} disabled={loading} title="Refresh">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        {txs.length > 0 && (
          <div style={{
            display: 'flex', gap: 8, padding: '8px 0 4px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 12,
          }}>
            <div style={{
              flex: 1, padding: '7px 10px', borderRadius: 8,
              background: 'rgba(0,212,170,0.06)',
              border: '1px solid rgba(0,212,170,0.15)',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Bridge In</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#00d4aa' }}>
                {inTxs.length} tx{inTxs.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{
              flex: 1, padding: '7px 10px', borderRadius: 8,
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.15)',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Bridge Out</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#3b82f6' }}>
                {outTxs.length} tx{outTxs.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!address ? (
          <div className="tx-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
              <rect x="2" y="7" width="20" height="15" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
            <span>Connect your wallet to see transaction history</span>
          </div>

        ) : loading && txs.length === 0 ? (
          <div className="tx-empty">
            <div className="spinner" style={{
              width: 24, height: 24,
              border: '2px solid rgba(0,212,170,0.2)',
              borderTopColor: 'var(--cyan)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span>Loading transactions...</span>
          </div>

        ) : txs.length === 0 ? (
          <div className="tx-empty" style={{ flexDirection: 'column', gap: 12, padding: '32px 0' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.2" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                No transactions yet
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Your bridge history will appear here
              </div>
            </div>
          </div>

        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {txs.map(tx => <TxRow key={tx.id} tx={tx} />)}
          </div>
        )}
      </div>
    </section>
  );
}

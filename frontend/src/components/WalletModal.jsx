import React, { useState } from 'react';

const WALLETS = [
  {
    id: 'injected',
    name: 'MetaMask',
    description: 'Connect using MetaMask or any browser wallet',
    icon: (
      <svg width="32" height="32" viewBox="0 0 35 33" fill="none">
        <path d="M32.9 1L19.6 10.7l2.4-5.7L32.9 1z" fill="#E17726" stroke="#E17726" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.1 1l13.2 9.8-2.3-5.8L2.1 1z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M28.2 23.5l-3.5 5.4 7.5 2.1 2.1-7.4-6.1-.1zM.8 23.6l2.1 7.4 7.5-2.1-3.5-5.4-6.1.1z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 14.4l-2.1 3.2 7.4.3-.2-8-5.1 4.5zM25 14.4l-5.2-4.6-.2 8.1 7.4-.3L25 14.4zM10.4 28.9l4.5-2.2-3.9-3-0.6 5.2zM20.1 26.7l4.5 2.2-.6-5.2-3.9 3z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M24.6 28.9l-4.5-2.2.4 3-.1.9 4.2-1.7zM10.4 28.9l4.2 1.7-.1-.9.4-3-4.5 2.2z" fill="#D5BFB2" stroke="#D5BFB2" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14.7 21.7l-3.7-1.1 2.6-1.2 1.1 2.3zM20.3 21.7l1.1-2.3 2.6 1.2-3.7 1.1z" fill="#233447" stroke="#233447" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.4 28.9l.6-5.4-4.1.1 3.5 5.3zM24 23.5l.6 5.4 3.5-5.3-4.1-.1zM27.4 17.6l-7.4.3.7 3.8 1.1-2.3 2.6 1.2 3-2.9-.1-.1zM11 20.6l2.6-1.2 1.1 2.3.7-3.8-7.4-.3 3 2.9v.1z" fill="#CC6228" stroke="#CC6228" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.9 17.6l3.1 6.1-.1-3-3-3.1zM24.1 20.6l-.1 3 3.1-6.1-3 3.1zM15.4 17.9l-.7 3.8.9 4.6.2-6.1-.4-2.3zM19.6 17.9l-.4 2.3.2 6.1.9-4.6-.7-3.8z" fill="#E27525" stroke="#E27525" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20.3 21.7l-.9 4.6.6.5 3.9-3 .1-3-3.7 1.1-.1-.2zM11 20.6l.1 3 3.9 3 .6-.5-.9-4.6-3.7-1.1v.2z" fill="#F5841F" stroke="#F5841F" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20.4 30.6l.1-.9-.4-.3h-5.5l-.3.3.1.9-4.2-1.7 1.5 1.2 3 2.1h5.1l3-2.1 1.5-1.2-4.4 1.7v-.3z" fill="#C0AC9D" stroke="#C0AC9D" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20.1 26.7l-.6-.5h-4l-.6.5-.4 3 .3-.3h5.5l.4.3-.6-3z" fill="#161616" stroke="#161616" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M33.5 11.3l1.1-5.5L32.9 1l-12.8 9.5 4.9 4.2 6.9 2 1.5-1.8-.7-.5 1.1-1-.8-.6 1.1-.8-.6-.7zM.4 5.8l1.1 5.5-.7.5 1.1.8-.8.6 1.1 1-.7.5 1.5 1.8 6.9-2 4.9-4.2L2.1 1 .4 5.8z" fill="#763E1A" stroke="#763E1A" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M32 13.7l-6.9-2 2.1 3.2-3.1 6.1 4.1-.1h6.1l-2.3-7.2zM9.9 11.7l-6.9 2-2.3 7.2h6.1l4.1.1-3.1-6.1 2.1-3.2zM19.6 17.9l.4-7-2 5.4h-5.1l-2-5.4.4 7 1.3 6.4 4.9.1 4.8-.1 1.3-6.4z" fill="#F5841F" stroke="#F5841F" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'talisman',
    name: 'Talisman',
    description: 'Connect using Talisman Wallet',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#D5FF5C"/>
        <path d="M16 6C10.477 6 6 10.477 6 16C6 21.523 10.477 26 16 26C21.523 26 26 21.523 26 16C26 10.477 21.523 6 16 6Z" fill="#1A1A1A"/>
        <path d="M16 10C12.686 10 10 12.686 10 16C10 19.314 12.686 22 16 22C19.314 22 22 19.314 22 16C22 12.686 19.314 10 16 10Z" fill="#D5FF5C"/>
        <circle cx="16" cy="16" r="3" fill="#1A1A1A"/>
      </svg>
    ),
  },
  {
    id: 'rabby',
    name: 'Rabby Wallet',
    description: 'Connect using Rabby Wallet',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#7B5DEF"/>
        <path d="M8 20.5C8 17.5 10.5 15 13.5 15H19C21.2 15 23 16.8 23 19C23 21.2 21.2 23 19 23H13C10.2 23 8 20.8 8 18V20.5Z" fill="white" opacity="0.9"/>
        <path d="M8 11.5C8 9.6 9.6 8 11.5 8H19.5C22 8 24 10 24 12.5C24 15 22 17 19.5 17H13C10.2 17 8 14.8 8 12V11.5Z" fill="white"/>
        <circle cx="20" cy="12.5" r="2" fill="#7B5DEF"/>
      </svg>
    ),
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    description: 'Connect using OKX Web3 Wallet',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#000"/>
        <rect x="6" y="6" width="8" height="8" rx="1" fill="white"/>
        <rect x="18" y="6" width="8" height="8" rx="1" fill="white"/>
        <rect x="6" y="18" width="8" height="8" rx="1" fill="white"/>
        <rect x="18" y="18" width="8" height="8" rx="1" fill="white"/>
        <rect x="12" y="12" width="8" height="8" rx="1" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    description: 'Scan with any mobile wallet',
    icon: (
      <svg width="32" height="32" viewBox="0 0 300 185" fill="none">
        <path d="M61.4 36.3c48.9-47.9 128.3-47.9 177.2 0l5.9 5.8a6.1 6.1 0 010 8.7l-20.1 19.7a3.2 3.2 0 01-4.4 0l-8.1-7.9c-34.1-33.4-89.4-33.4-123.5 0l-8.7 8.5a3.2 3.2 0 01-4.4 0L55.2 51.4a6.1 6.1 0 010-8.7l6.2-6.4zm218.8 40.8l17.9 17.5a6.1 6.1 0 010 8.7l-80.7 79a6.3 6.3 0 01-8.9 0l-57.3-56.1a1.6 1.6 0 00-2.2 0l-57.2 56.1a6.3 6.3 0 01-8.9 0L2.2 103.3a6.1 6.1 0 010-8.7l17.9-17.5a6.3 6.3 0 018.9 0l57.3 56.1c.6.6 1.6.6 2.2 0l57.2-56.1a6.3 6.3 0 018.9 0l57.3 56.1c.6.6 1.6.6 2.2 0l57.2-56.1a6.3 6.3 0 018.9 0z" fill="#3B99FC"/>
      </svg>
    ),
  },
];

export default function WalletModal({ onConnect, onConnectTalisman, onConnectRabby, onConnectOKX, onConnectWC, onClose, hasWC }) {
  const [connecting, setConnecting] = useState(null);

  const handle = async (id) => {
    setConnecting(id);
    try {
      if (id === 'injected') await onConnect();
      else if (id === 'talisman') await onConnectTalisman();
      else if (id === 'rabby') await onConnectRabby();
      else if (id === 'okx') await onConnectOKX();
      else if (id === 'walletconnect') await onConnectWC();
      onClose();
    } catch {}
    setConnecting(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:'1.05rem' }}>Connect Wallet</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.2rem', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {WALLETS.map(w => {
            const disabled = w.id === 'walletconnect' && !hasWC;
            return (
              <button key={w.id}
                onClick={() => !disabled && handle(w.id)}
                disabled={connecting === w.id || disabled}
                style={{
                  display:'flex', alignItems:'center', gap:14,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  transition: 'border-color .15s',
                  width: '100%', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ flexShrink:0 }}>{w.icon}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.95rem', color:'var(--text)', marginBottom:2 }}>
                    {w.name}
                    {w.id === 'walletconnect' && !hasWC && (
                      <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginLeft:8 }}>Project ID needed</span>
                    )}
                  </div>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{w.description}</div>
                </div>
                {connecting === w.id && <div className="spinner" style={{ marginLeft:'auto', width:16, height:16, borderWidth:2 }} />}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:16, textAlign:'center', lineHeight:1.5 }}>
          By connecting, you agree to the Terms of Service.<br/>
          Make sure you're on <span style={{ color:'var(--cyan)' }}>Bittensor EVM (964)</span>.
        </p>
      </div>
    </div>
  );
}

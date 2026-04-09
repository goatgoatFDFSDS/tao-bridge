import React from 'react';

export default function DocsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">TAOflow — Documentation</span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">

          {/* Overview */}
          <div className="doc-section">
            <h3 className="doc-h3">What is TAOflow?</h3>
            <p className="doc-p">
              TAOflow is a bidirectional bridge that lets you move stablecoins (USDC, USDT) from
              Ethereum, Base or BSC to <strong>Bittensor EVM (Chain 964)</strong> and receive native TAO —
              and vice versa. The conversion rate is fetched live from CoinGecko.
            </p>
          </div>

          {/* Stable → TAO */}
          <div className="doc-section">
            <h3 className="doc-h3">Stable → TAO</h3>
            <div className="doc-steps">
              {[
                ['Connect wallet', 'MetaMask auto-switches to Bittensor EVM on connect. You\'ll need to manually switch to your source chain (ETH / Base / BSC) to approve and deposit.'],
                ['Select chain & token', 'Choose the source chain (Ethereum, Base or BSC) and the token (USDC or USDT).'],
                ['Approve', 'First transaction — allows the vault contract to spend your tokens. Only needed once per token.'],
                ['Deposit', 'Tokens are locked in the BridgeVault contract on the source chain. A Deposit event is emitted.'],
                ['Relay', 'The off-chain relayer detects the event, fetches the current TAO/USD price, and sends the equivalent TAO to your recipient address on Bittensor EVM.'],
                ['Receive TAO', 'Native TAO arrives in your wallet on Bittensor EVM within 1 to 5 minutes.'],
              ].map(([t, d], i) => (
                <div className="doc-step" key={i}>
                  <div className="doc-step-num">{i + 1}</div>
                  <div>
                    <div className="doc-step-title">{t}</div>
                    <div className="doc-step-desc">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TAO → Stable */}
          <div className="doc-section">
            <h3 className="doc-h3">TAO → Stable</h3>
            <div className="doc-steps">
              {[
                ['Switch to Bittensor EVM', 'Make sure MetaMask is on chain 964.'],
                ['Select destination', 'Choose where you want to receive stablecoins (Ethereum, Base or BSC) and which token (USDC or USDT).'],
                ['Send TAO', 'TAO is sent to the TaoReceiver contract on Bittensor EVM. A TaoDeposit event is emitted.'],
                ['Relay', 'The relayer detects the event, calculates the equivalent stablecoin amount at current price, and calls release on the destination vault.'],
                ['Receive stables', 'USDC or USDT arrives in your wallet on the destination chain within 1 to 5 minutes.'],
              ].map(([t, d], i) => (
                <div className="doc-step" key={i}>
                  <div className="doc-step-num">{i + 1}</div>
                  <div>
                    <div className="doc-step-title">{t}</div>
                    <div className="doc-step-desc">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contracts */}
          <div className="doc-section">
            <h3 className="doc-h3">Smart contracts</h3>
            <div className="doc-table">
              <div className="doc-row doc-row-head">
                <span>Contract</span><span>Chain</span><span>Role</span>
              </div>
              {[
                ['BridgeVault', 'ETH / Base / BSC', 'Locks stablecoins on deposit, releases on relayer instruction'],
                ['TaoReceiver', 'Bittensor EVM 964', 'Receives native TAO from users bridging back to stables'],
              ].map(([name, chain, role]) => (
                <div className="doc-row" key={name}>
                  <span className="doc-mono">{name}</span>
                  <span>{chain}</span>
                  <span style={{ color: 'var(--text-sub)' }}>{role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="doc-section">
            <h3 className="doc-h3">Security</h3>
            <ul className="doc-list">
              <li>Nonce-based replay protection on both source and destination contracts</li>
              <li>SQLite database on the relayer tracks all processed events — no double processing</li>
              <li>Emergency withdrawal functions (owner-only) on all contracts</li>
              <li>Relayer retries failed transactions up to 5 times with backoff</li>
              <li>Rate derived from live CoinGecko price — no on-chain oracle dependency</li>
            </ul>
          </div>

          {/* Links */}
          <div className="doc-section">
            <h3 className="doc-h3">Links</h3>
            <div className="doc-links">
              {[
                ['Bittensor EVM Explorer', 'https://evm.taostats.io'],
                ['Bittensor Docs', 'https://docs.bittensor.com/evm-tutorials'],
                ['TAO on CoinGecko', 'https://www.coingecko.com/en/coins/bittensor'],
              ].map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noreferrer" className="doc-link">
                  {label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginLeft:4}}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

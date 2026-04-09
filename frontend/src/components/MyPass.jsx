import React, { useMemo, useState } from 'react';
import { useMyPass } from '../hooks/useMyPass';

const PASS_CONTRACT = import.meta.env.VITE_PASS_CONTRACT || '0x3abFa4d820878522Df211A884216242475183967';
const EXPLORER_BASE = 'https://evm.taostats.io';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const short = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
const fmtUSD = (n) => n >= 1000
  ? `$${(n / 1000).toFixed(1)}k`
  : `$${n.toFixed(2)}`;

function computeStats(txs, taoPrice) {
  if (!txs?.length) return { bridges: 0, bridgesIn: 0, bridgesOut: 0, volume: 0, feesSaved: 0 };
  let volume = 0, feesSaved = 0, bridgesIn = 0, bridgesOut = 0;
  for (const tx of txs) {
    if (tx.type === 'stable→tao') {
      bridgesIn++;
      volume     += tx.amount;
      feesSaved  += tx.amount * 0.01;
    } else {
      bridgesOut++;
      const usd   = tx.amount * (taoPrice || 0);
      volume     += usd;
      feesSaved  += usd * 0.05;
    }
  }
  return { bridges: txs.length, bridgesIn, bridgesOut, volume, feesSaved };
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 18, r = 8, style = {} }) {
  return <div className="mp-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// ─── Benefit item ──────────────────────────────────────────────────────────────
function Benefit({ icon, label, desc, active = true }) {
  return (
    <div className={`mp-benefit ${active ? '' : 'mp-benefit--dim'}`}>
      <div className="mp-benefit-icon">{icon}</div>
      <div>
        <div className="mp-benefit-label">{label}</div>
        <div className="mp-benefit-desc">{desc}</div>
      </div>
      {active && <div className="mp-benefit-check">✓</div>}
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`mp-stat-card ${accent ? 'mp-stat-card--accent' : ''}`}>
      <div className="mp-stat-value">{value}</div>
      <div className="mp-stat-label">{label}</div>
      {sub && <div className="mp-stat-sub">{sub}</div>}
    </div>
  );
}

// ─── NFT Details row ───────────────────────────────────────────────────────────
function NFTDetails({ tokenId }) {
  return (
    <div className="mp-details-card">
      <div className="mp-details-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        NFT Details
      </div>
      <div className="mp-details-grid">
        {[
          { k: 'Collection',  v: 'TAOflow Pass' },
          { k: 'Supply',      v: '500 / 500' },
          { k: 'Chain',       v: 'Bittensor EVM (964)' },
          { k: 'Standard',    v: 'ERC-721A' },
          { k: 'Contract',    v: (
            <a
              href={`${EXPLORER_BASE}/address/${PASS_CONTRACT}`}
              target="_blank" rel="noreferrer"
              className="mp-link"
            >
              {short(PASS_CONTRACT)} ↗
            </a>
          )},
          ...(tokenId ? [{ k: 'Your Token', v: `#${tokenId}` }] : []),
        ].map(({ k, v }) => (
          <div className="mp-detail-row" key={k}>
            <span className="mp-detail-key">{k}</span>
            <span className="mp-detail-val">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Marketplace tooltip buttons ───────────────────────────────────────────────
function MarketplaceButtons() {
  const [show, setShow] = useState(false);
  return (
    <div className="mp-mkt-wrap">
      <button
        className="mp-btn-mkt-disabled"
        onClick={() => setShow(s => !s)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        View Collection
      </button>
      <button
        className="mp-btn-mkt-disabled"
        onClick={() => setShow(s => !s)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        Get on Marketplace
      </button>
      {show && (
        <div className="mp-mkt-tooltip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Listing soon on Tao Punks Marketplace
        </div>
      )}
    </div>
  );
}

// ─── Benefits panel ────────────────────────────────────────────────────────────
function BenefitsPanel({ active }) {
  const benefits = [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
      label: '0% Bridge Fees',
      desc: 'Zero protocol fees on all bridge directions',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      label: 'Trading Bot Access',
      desc: 'Full access to TAOflow Trading Bot features',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
        </svg>
      ),
      label: 'Reward Boosts',
      desc: 'Enhanced multipliers on ecosystem rewards',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      label: 'Ecosystem Access',
      desc: 'Priority access to new TAOflow products',
    },
  ];
  return (
    <div className="mp-card mp-benefits-card">
      <div className="mp-card-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        Holder Benefits
      </div>
      <div className="mp-benefits-list">
        {benefits.map((b) => (
          <Benefit key={b.label} {...b} active={active} />
        ))}
      </div>
    </div>
  );
}

// ─── Loading skeleton layout ────────────────────────────────────────────────────
function SkeletonLayout() {
  return (
    <div className="mp-grid">
      <div className="mp-col-left">
        <div className="mp-card mp-nft-card">
          <Skeleton h={260} r={12} style={{ marginBottom: 20 }} />
          <Skeleton w="60%" h={22} style={{ marginBottom: 10 }} />
          <Skeleton w="40%" h={16} style={{ marginBottom: 8 }} />
          <Skeleton w="55%" h={16} style={{ marginBottom: 20 }} />
          <Skeleton h={44} r={10} />
        </div>
      </div>
      <div className="mp-col-right">
        <div className="mp-card" style={{ padding: 24, marginBottom: 16 }}>
          <Skeleton w="40%" h={16} style={{ marginBottom: 16 }} />
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
              <Skeleton w={36} h={36} r={10} />
              <div style={{ flex: 1 }}>
                <Skeleton w="50%" h={14} style={{ marginBottom: 6 }} />
                <Skeleton w="75%" h={12} />
              </div>
            </div>
          ))}
        </div>
        <div className="mp-card" style={{ padding: 24 }}>
          <Skeleton w="40%" h={16} style={{ marginBottom: 16 }} />
          <div className="mp-stats-grid">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} h={76} r={10} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grayed marketplace button (inside card) ───────────────────────────────────
function MarketplaceCardBtn() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="mp-btn-primary mp-btn-primary--dim"
        onClick={() => setShow(s => !s)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        Open Marketplace
      </button>
      {show && (
        <div className="mp-mkt-tooltip mp-mkt-tooltip--top">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Listing soon on Tao Punks Marketplace
        </div>
      )}
    </div>
  );
}

// ─── Token ID chips ────────────────────────────────────────────────────────────
function TokenChips({ tokenIds, loading }) {
  if (loading && tokenIds.length === 0) {
    return (
      <div className="mp-token-chips">
        {[0, 1].map(i => <Skeleton key={i} w={72} h={26} r={6} />)}
      </div>
    );
  }
  if (tokenIds.length === 0) return null;
  return (
    <div className="mp-token-chips">
      {tokenIds.map(id => (
        <a
          key={id}
          href={`${EXPLORER_BASE}/token/${PASS_CONTRACT}/instance/${id}`}
          target="_blank"
          rel="noreferrer"
          className="mp-token-chip"
          title={`View #${id} on explorer`}
        >
          #{id}
        </a>
      ))}
    </div>
  );
}

// ─── Holder layout ─────────────────────────────────────────────────────────────
function HolderLayout({ tokenIds, tokenIdsLoading, balance, address, stats }) {
  const firstId = tokenIds[0] || null;
  const multi   = balance > 1;

  return (
    <>
      <div className="mp-grid">
        {/* Left: NFT card */}
        <div className="mp-col-left">
          <div className="mp-card mp-nft-card mp-nft-card--glow">
            <div className="mp-nft-img-wrap">
              <img src="/nft.png" alt="TAOflow Pass" className="mp-nft-img" />
              <div className="mp-nft-img-glow" />
            </div>

            <div className="mp-nft-info">
              <div className="mp-nft-heading">
                <span className="mp-nft-title">TAOflow Pass</span>
                <span className="mp-badge-active">Active</span>
              </div>

              <div className="mp-nft-subtitle">
                {multi ? `${balance} Passes` : 'Pass Holder'}
              </div>

              {/* Address chip */}
              <div className="mp-nft-meta">
                <div className="mp-meta-chip">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  {short(address)}
                </div>
                {multi && (
                  <div className="mp-meta-chip mp-meta-chip--accent">
                    ×{balance} passes
                  </div>
                )}
              </div>

              {/* Token IDs grid */}
              <TokenChips tokenIds={tokenIds} loading={tokenIdsLoading} />

              <a
                href={`${EXPLORER_BASE}/address/${address}/tokens#tokentxnsErc721`}
                target="_blank"
                rel="noreferrer"
                className="mp-btn-primary"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View on Explorer
              </a>

              <MarketplaceCardBtn />
            </div>
          </div>
        </div>

        {/* Right: benefits + activity */}
        <div className="mp-col-right">
          <BenefitsPanel active={true} />

          <div className="mp-card mp-activity-card">
            <div className="mp-card-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Bridge Activity
            </div>
            <div className="mp-stats-grid">
              <StatCard label="Total Bridges"  value={stats.bridges}            sub={`${stats.bridgesIn} in · ${stats.bridgesOut} out`} />
              <StatCard label="Volume Bridged" value={fmtUSD(stats.volume)}     sub="USD equivalent" />
              <StatCard label="Fees Saved"     value={fmtUSD(stats.feesSaved)}  sub="thanks to Pass" accent />
              <StatCard label="Rewards"        value="Eligible"                 sub="Future drops"   accent />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: details */}
      <div className="mp-bottom">
        <NFTDetails tokenId={firstId} />
      </div>
    </>
  );
}

// ─── Non-holder layout ─────────────────────────────────────────────────────────
function NonHolderLayout() {
  return (
    <>
      {/* Empty state */}
      <div className="mp-empty-card">
        <div className="mp-empty-img-wrap">
          <img src="/nft.png" alt="TAOflow Pass" className="mp-empty-img" />
          <div className="mp-empty-overlay" />
        </div>
        <div className="mp-empty-body">
          <div className="mp-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="mp-empty-title">No TAOflow Pass Detected</h3>
          <p className="mp-empty-sub">
            Connect a wallet that holds a TAOflow Pass NFT, or acquire one on the secondary market to unlock all holder perks.
          </p>
          <MarketplaceButtons />
        </div>
      </div>

      {/* Benefits (dimmed) + Details */}
      <div className="mp-grid mp-grid--single">
        <BenefitsPanel active={false} />
        <NFTDetails tokenId={null} />
      </div>

      <div className="mp-bottom mp-bottom--center">
        <div className="mp-mkt-cta-wrap">
          <span className="mp-mkt-label">Acquire a pass on the secondary market</span>
          <button className="mp-btn-cta mp-btn-cta--dim" disabled>
            Buy on TaoPunk
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Connect prompt ─────────────────────────────────────────────────────────────
function ConnectPrompt({ connect }) {
  return (
    <div className="mp-connect-card">
      <div className="mp-connect-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      </div>
      <h3 className="mp-connect-title">Connect your wallet</h3>
      <p className="mp-connect-sub">Connect your wallet to check your TAOflow Pass ownership and view your bridge activity.</p>
      <button className="mp-btn-primary mp-btn-primary--lg" onClick={connect}>
        Connect Wallet
      </button>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function MyPass({ address, txs, taoPrice, connect }) {
  const { loading, hasPass, tokenIds, balance } = useMyPass(address);
  const tokenIdsLoading = hasPass && tokenIds.length === 0;
  const stats = useMemo(() => computeStats(txs, taoPrice), [txs, taoPrice]);

  return (
    <div className="mypass-page">
      {/* Hero */}
      <section className="mp-hero">
        <h1 className="mp-hero-title">
          My <span className="grad">Pass</span>
        </h1>
        <p className="mp-hero-sub">
          TAOflow Pass — 500 unique NFTs granting holders 0% bridge fees, trading bot access, and ecosystem priority.
        </p>
      </section>

      {/* Content */}
      <div className="mp-wrap">
        {!address ? (
          <ConnectPrompt connect={connect} />
        ) : loading ? (
          <SkeletonLayout />
        ) : hasPass ? (
          <HolderLayout tokenIds={tokenIds} tokenIdsLoading={tokenIdsLoading} balance={balance} address={address} stats={stats} />
        ) : (
          <NonHolderLayout />
        )}
      </div>
    </div>
  );
}

require('dotenv').config();

const CHAIN = {
  ETH:       1,
  BASE:      8453,
  BSC:       56,
  BITTENSOR: 964,
};

// Blocks to wait before processing (reorg protection)
const CONFIRMATIONS = {
  [CHAIN.ETH]:       12,
  [CHAIN.BASE]:      5,
  [CHAIN.BSC]:       15,
  [CHAIN.BITTENSOR]: 3,
};

const POLL_INTERVAL = 12_000; // ms

// ── Source chains ────────────────────────────────────────────────────────────
const SOURCE_CHAINS = [
  {
    name:         'Ethereum',
    chainId:      CHAIN.ETH,
    rpc:          process.env.ETH_RPC,
    vaultAddress: process.env.ETH_VAULT_ADDRESS,
    tokens: {
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6  },
      USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6  },
    },
  },
  {
    name:         'Base',
    chainId:      CHAIN.BASE,
    rpc:          process.env.BASE_RPC,
    vaultAddress: process.env.BASE_VAULT_ADDRESS,
    tokens: {
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6  },
      USDT: { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6  },
    },
  },
  {
    name:         'BSC',
    chainId:      CHAIN.BSC,
    rpc:          process.env.BSC_RPC,
    vaultAddress: process.env.BSC_VAULT_ADDRESS,
    tokens: {
      USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    },
  },
];

// ── Bittensor EVM ─────────────────────────────────────────────────────────────
const BITTENSOR_CHAIN = {
  name:            'Bittensor EVM',
  chainId:         CHAIN.BITTENSOR,
  rpc:             process.env.BITTENSOR_RPC || 'https://lite.chain.opentensor.ai',
  taoReceiverAddress: process.env.BITTENSOR_TAO_RECEIVER_ADDRESS,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert raw stablecoin amount (in token's native decimals) to a USD float
 * e.g. 1_000_000n (USDC 6 dec) → 1.0
 *      1_000_000_000_000_000_000n (BSC USDT 18 dec) → 1.0
 */
function toUSD(rawAmount, decimals) {
  const divisor = BigInt(10 ** decimals);
  const whole   = rawAmount / divisor;
  const frac    = rawAmount % divisor;
  return Number(whole) + Number(frac) / (10 ** decimals);
}

/**
 * Convert USD float to raw TAO in wei (18 decimals)
 * e.g. 100 USD at $400/TAO → 0.25 TAO → 250_000_000_000_000_000n
 */
function usdToTaoWei(usdAmount, taoPrice) {
  const tao = usdAmount / taoPrice;
  // Use BigInt to avoid floating point precision issues
  const taoWei = BigInt(Math.floor(tao * 1e12)) * BigInt(1e6);
  return taoWei;
}

/**
 * Convert raw TAO wei to USD float
 */
function taoWeiToUSD(taoWei, taoPrice) {
  // Use BigInt math to avoid precision loss (taoWei can exceed Number.MAX_SAFE_INTEGER)
  const tao = Number(BigInt(taoWei) * 1000000n / BigInt(1e18)) / 1000000;
  return tao * taoPrice;
}

/**
 * Convert USD float to raw stable amount in token decimals
 */
function usdToStableRaw(usdAmount, decimals) {
  const multiplier = BigInt(10 ** decimals);
  return BigInt(Math.floor(usdAmount * (10 ** decimals))) * BigInt(1) / BigInt(1)
    || BigInt(Math.floor(usdAmount)) * multiplier;
}

// Cleaner version
function usdToStable(usdAmount, decimals) {
  // Convert to cents precision then scale
  const cents = Math.round(usdAmount * 100);
  if (decimals === 6)  return BigInt(cents) * BigInt(10_000);        // 100 * 10000 = 1_000_000
  if (decimals === 18) return BigInt(cents) * BigInt(10n ** 16n);    // 100 * 1e16  = 1e18
  throw new Error(`Unsupported decimals: ${decimals}`);
}

/**
 * Get token decimals for a given chainId + token address
 */
function getTokenDecimals(chainId, tokenAddress) {
  const chain = SOURCE_CHAINS.find(c => c.chainId === chainId);
  if (!chain) return null;
  for (const t of Object.values(chain.tokens)) {
    if (t.address.toLowerCase() === tokenAddress.toLowerCase()) return t.decimals;
  }
  return null;
}

module.exports = {
  CHAIN,
  CONFIRMATIONS,
  POLL_INTERVAL,
  SOURCE_CHAINS,
  BITTENSOR_CHAIN,
  toUSD,
  usdToTaoWei,
  taoWeiToUSD,
  usdToStable,
  getTokenDecimals,
};

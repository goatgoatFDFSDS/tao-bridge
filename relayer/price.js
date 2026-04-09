/**
 * Live TAO/USD price from CoinGecko
 * Cached 30s to avoid rate limits
 */
const https = require('https');

const BINANCE_URL    = 'https://api.binance.com/api/v3/ticker/price?symbol=TAOUSDT';
const COINGECKO_URL  = 'https://api.coingecko.com/api/v3/simple/price?ids=bittensor&vs_currencies=usd';

let _cached = null;
let _cachedAt = 0;
const CACHE_MS = 30_000;

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'TAOflow-Bridge/1.0', ...headers } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchPrice() {
  // Primary: Binance (no rate limit, no API key)
  try {
    const json  = await fetchUrl(BINANCE_URL);
    const price = parseFloat(json?.price);
    if (price > 0) return price;
  } catch { /* fallback */ }

  // Fallback: CoinGecko
  const json  = await fetchUrl(COINGECKO_URL);
  const price = json?.bittensor?.usd;
  if (!price) throw new Error('No TAO price available');
  return price;
}

async function getTaoPrice() {
  const now = Date.now();
  if (_cached && now - _cachedAt < CACHE_MS) return _cached;

  const price = await fetchPrice();
  _cached  = price;
  _cachedAt = now;
  console.log(`[Price] TAO/USD = $${price}`);
  return price;
}

module.exports = { getTaoPrice };

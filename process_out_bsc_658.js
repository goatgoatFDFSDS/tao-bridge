require('dotenv').config();
const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const rawDb = require('./node_modules/better-sqlite3')('./relayer.db');

const bscSigner = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY,
  new ethers.JsonRpcProvider(process.env.BSC_RPC || 'https://bsc.publicnode.com')
);
const VAULT    = ethers.getAddress('0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063');
const USDT_BSC = ethers.getAddress('0x55d398326f99059fF775485246999027B3197955');
const ABI      = ['function release(address token, address recipient, uint256 amount, uint256 srcNonce) external'];

// Synthetic nonce 2019 (won't conflict with real processed nonces)
const SYNTH_NONCE = 2019;

(async () => {
  const already = rawDb.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=? AND dest_chain_id=56').get(String(SYNTH_NONCE));
  if (already) { console.log('Already done:', already.tx_hash); return; }

  const taoPrice = await getTaoPrice();
  const netTao = 0.0148 * 0.95;
  // USDT BSC = 18 decimals
  const usdtAmt = ethers.parseUnits((netTao * taoPrice).toFixed(18), 18);
  const recip = ethers.getAddress('0xc219d78cda6c0f3a732c2e58e2bee2679067ad75');

  console.log('Releasing', ethers.formatUnits(usdtAmt, 18), 'USDT BSC to', recip, '@ $'+taoPrice);
  const vault = new ethers.Contract(VAULT, ABI, bscSigner);
  const tx = await vault.release(USDT_BSC, recip, usdtAmt, SYNTH_NONCE);
  console.log('TX:', tx.hash);
  await tx.wait();
  rawDb.prepare('INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?,56,?)').run(String(SYNTH_NONCE), tx.hash);
  console.log('Done ✓');
})().catch(console.error);

require('dotenv').config();
const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const rawDb = require('./node_modules/better-sqlite3')('./relayer.db');

const baseSigner = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org'));
const VAULT = ethers.getAddress('0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063');
const USDC  = ethers.getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
const ABI   = ['function release(address token, address recipient, uint256 amount, uint256 srcNonce) external'];

(async () => {
  const already = rawDb.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=? AND dest_chain_id=8453').get('14');
  if (already) { console.log('Already done:', already.tx_hash); return; }

  const taoPrice = await getTaoPrice();
  const netTao = 0.874 * 0.95;
  const usdcAmt = ethers.parseUnits((netTao * taoPrice).toFixed(6), 6);
  const recip = ethers.getAddress('0x12345493088Fd26DEDAb720d3Ce8931aF4990d72');
  console.log('Releasing', ethers.formatUnits(usdcAmt, 6), 'USDC to', recip, '@ $'+taoPrice);
  const vault = new ethers.Contract(VAULT, ABI, baseSigner);
  const tx = await vault.release(USDC, recip, usdcAmt, 14);
  console.log('TX:', tx.hash);
  await tx.wait();
  rawDb.prepare('INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?,8453,?)').run('14', tx.hash);
  console.log('Done ✓');
})().catch(console.error);

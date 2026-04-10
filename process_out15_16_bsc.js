require('dotenv').config();
const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const rawDb = require('./node_modules/better-sqlite3')('./relayer.db');

const bscSigner = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY,
  new ethers.JsonRpcProvider(process.env.BSC_RPC || 'https://bsc.publicnode.com')
);
const USDC_BSC = ethers.getAddress('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d');
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
const recip = ethers.getAddress('0xed59d5bf9c5e3b681e69329628d560A30a98f58a');

(async () => {
  const taoPrice = await getTaoPrice();
  console.log('TAO price: $' + taoPrice);

  const usdc = new ethers.Contract(USDC_BSC, ERC20_ABI, bscSigner);

  // Nonce 15 — 0.31 TAO
  const already15 = rawDb.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=? AND dest_chain_id=56').get('15');
  if (already15) {
    console.log('[15] Already done:', already15.tx_hash);
  } else {
    const amt15 = ethers.parseUnits((0.31 * 0.95 * taoPrice).toFixed(18), 18);
    console.log('[15] Sending', ethers.formatUnits(amt15, 18), 'USDC to', recip);
    const tx15 = await usdc.transfer(recip, amt15);
    console.log('[15] TX:', tx15.hash);
    await tx15.wait();
    rawDb.prepare('INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?,56,?)').run('15', tx15.hash);
    console.log('[15] Done ✓');
  }

  // Nonce 16 — 0.275 TAO
  const already16 = rawDb.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=? AND dest_chain_id=56').get('16');
  if (already16) {
    console.log('[16] Already done:', already16.tx_hash);
  } else {
    const amt16 = ethers.parseUnits((0.275 * 0.95 * taoPrice).toFixed(18), 18);
    console.log('[16] Sending', ethers.formatUnits(amt16, 18), 'USDC to', recip);
    const tx16 = await usdc.transfer(recip, amt16);
    console.log('[16] TX:', tx16.hash);
    await tx16.wait();
    rawDb.prepare('INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?,56,?)').run('16', tx16.hash);
    console.log('[16] Done ✓');
  }
})().catch(console.error);

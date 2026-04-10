require('dotenv').config();
const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const rawDb = require('./node_modules/better-sqlite3')('./relayer.db');

const baseSigner = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY,
  new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org')
);
const BASE_VAULT = ethers.getAddress('0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063');
const USDC_BASE  = ethers.getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
const VAULT_ABI  = ['function release(address token, address recipient, uint256 amount, uint256 srcNonce) external'];

(async () => {
  const taoPrice = await getTaoPrice();
  const netTao = 0.132 * 0.95;
  const usdcAmt = ethers.parseUnits((netTao * taoPrice).toFixed(6), 6);
  const recip = ethers.getAddress('0xC74c55271935fA3b2e02e5a82ADa7E58549de479');
  console.log('Releasing', ethers.formatUnits(usdcAmt, 6), 'USDC to', recip, '@ $'+taoPrice);
  const vault = new ethers.Contract(BASE_VAULT, VAULT_ABI, baseSigner);
  const tx = await vault.release(USDC_BASE, recip, usdcAmt, 12);
  console.log('TX:', tx.hash);
  await tx.wait();
  rawDb.prepare('INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?,8453,?)').run('12', tx.hash);
  console.log('Done ✓');
})().catch(console.error);

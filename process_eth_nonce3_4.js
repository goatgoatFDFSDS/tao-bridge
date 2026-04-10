require('dotenv').config();
const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC || 'https://ethereum.publicnode.com');
const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const ETH_VAULT = '0x6eC196A4330d6F48Fa7f2f908b1F6CCebe9E6Fcb';
const USDT      = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const RECIP     = '0x54c37879325c713156aA8bBc45e9A398798D11b9';

// 0.000855 TAO * 311 + 0.00095 * 311 = 0.2659 + 0.2955 = 0.5614 USDT
const AMOUNT = ethers.parseUnits('0.56', 6);

const VAULT_ABI = ['function release(address token, address recipient, uint256 amount, uint256 srcNonce) external'];

(async () => {
  const taoPrice = 311;
  console.log('Sending', ethers.formatUnits(AMOUNT, 6), 'USDT to', RECIP, '(nonces 3+4 combined)');

  // Use nonce 3 for the release (nonce 4 we mark manually)
  const vault = new ethers.Contract(ETH_VAULT, VAULT_ABI, signer);
  const tx = await vault.release(USDT, RECIP, AMOUNT, 3);
  console.log('TX sent:', tx.hash);
  await tx.wait();
  console.log('Confirmed');

  db.prepare("INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?, 1, ?)").run('3', tx.hash);
  db.prepare("INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?, 1, ?)").run('4', tx.hash);
  console.log('DB updated for nonces 3 & 4');
})().catch(console.error);

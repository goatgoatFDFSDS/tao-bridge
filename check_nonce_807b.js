require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
             'function depositNonce() view returns (uint256)'];
const c = new ethers.Contract(RECEIVER, ABI, provider);
(async () => {
  const nonce = await c.depositNonce();
  console.log('Current depositNonce:', nonce.toString());
  // Check last few nonces in DB
  const rows = db.prepare('SELECT withdraw_nonce, tx_hash FROM processed_withdrawals ORDER BY withdraw_nonce*1 DESC LIMIT 5').all();
  console.log('Last processed OUT nonces:', rows.map(r => r.withdraw_nonce).join(', '));
  // Check nonces 27-30
  for (let n = 27; n <= 30; n++) {
    const r = db.prepare('SELECT * FROM processed_withdrawals WHERE withdraw_nonce=?').get(String(n));
    console.log('Nonce', n, ':', r ? 'DONE' : 'NOT IN DB');
  }
})().catch(console.error);

require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const ABI = [
  'event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
  'function depositNonce() view returns (uint256)'
];
const c = new ethers.Contract(RECEIVER, ABI, provider);
(async () => {
  const nonce = await c.depositNonce();
  console.log('depositNonce:', nonce.toString());
  // Check nonces 29-32
  for (let n = 29; n <= 32; n++) {
    const r = db.prepare('SELECT * FROM processed_withdrawals WHERE withdraw_nonce=?').get(String(n));
    console.log('Nonce', n, ':', r ? 'DONE' : 'NOT IN DB');
  }
  // Try to find event at block 7917100
  try {
    const events = await c.queryFilter(c.filters.TaoDeposit(), 7917050, 7917150);
    for (const ev of events) {
      console.log('Found! Nonce:', ev.args.nonce.toString(), '| gross:', ethers.formatEther(ev.args.grossAmount), '| recipient:', ev.args.recipient);
    }
  } catch(e) { console.log('RPC event query failed'); }
})().catch(console.error);

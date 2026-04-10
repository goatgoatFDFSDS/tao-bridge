require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const c = new ethers.Contract(RECEIVER, ABI, provider);

(async () => {
  // Block 7916426 — search from 7915000 to 7917000
  for (let from = 7915000; from <= 7917100; from += 100) {
    try {
      const events = await c.queryFilter(c.filters.TaoDeposit(), from, from + 99);
      for (const ev of events) {
        const nonce = ev.args.nonce.toString();
        const row = db.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=?').get(nonce);
        console.log(`Block ${ev.blockNumber} | Nonce ${nonce} | dest:${ev.args.destChainId} | ${ethers.formatEther(ev.args.grossAmount)} TAO | ${ev.args.recipient} | ${row ? 'DONE' : 'PENDING'}`);
      }
    } catch(e) { process.stdout.write('.'); }
  }
  console.log('\nDone scanning');
})().catch(console.error);

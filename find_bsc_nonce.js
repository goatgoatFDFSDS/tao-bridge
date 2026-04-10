require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const c = new ethers.Contract(RECEIVER, ABI, provider);

(async () => {
  const current = await provider.getBlockNumber();
  console.log('Current block:', current);
  // Search last 1000 blocks in batches of 100
  for (let from = current - 1000; from <= current; from += 100) {
    try {
      const events = await c.queryFilter(c.filters.TaoDeposit(), from, from + 99);
      for (const ev of events) {
        const nonce = ev.args.nonce.toString();
        const row = db.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=?').get(nonce);
        const status = row ? 'DONE' : 'NOT PROCESSED';
        console.log(`Block ${ev.blockNumber} | Nonce ${nonce} | dest:${ev.args.destChainId} | gross:${ethers.formatEther(ev.args.grossAmount)} TAO | ${ev.args.recipient} | ${status}`);
      }
    } catch(e) {}
  }
})().catch(console.error);

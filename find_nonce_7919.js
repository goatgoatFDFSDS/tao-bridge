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

  // Check nonces 31-33 in DB
  for (let n = 31; n <= 33; n++) {
    const r = db.prepare('SELECT * FROM processed_withdrawals WHERE withdraw_nonce=?').get(String(n));
    console.log('Nonce', n, ':', r ? 'DONE - ' + r.tx_hash : 'NOT IN DB');
  }

  // Scan around block 7919187
  for (let from = 7919100; from <= 7919300; from += 100) {
    try {
      const events = await c.queryFilter(c.filters.TaoDeposit(), from, from + 99);
      for (const ev of events) {
        console.log('Block:', ev.blockNumber, '| Nonce:', ev.args.nonce.toString(),
          '| dest:', ev.args.destChainId.toString(),
          '| gross:', ethers.formatEther(ev.args.grossAmount),
          '| recipient:', ev.args.recipient);
      }
    } catch(e) { process.stdout.write('.'); }
  }
  console.log('\nDone');
})().catch(console.error);

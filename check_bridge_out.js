const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const tao  = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const base = new ethers.JsonRpcProvider('https://base.publicnode.com');

const RECIP = '0x5c5ac3552e55add6a9054450eacc04d9bce6e754';
const RECEIVERS = [
  '0x560F9e82e941C8dD8D6A8c75e06E4142210d6a84',
  '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577',
];
const TAO_RECEIVER_ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];

const VAULT_ABI = ['event Released(address indexed token, address indexed recipient, uint256 amount, uint256 srcNonce)'];
const BASE_VAULT = '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063';

(async () => {
  const latest = await tao.getBlockNumber();
  const from   = Math.max(0, latest - 50000);

  let found = [];
  for (const addr of RECEIVERS) {
    const receiver = new ethers.Contract(addr, TAO_RECEIVER_ABI, tao);
    for (let b = from; b <= latest; b += 5000) {
      const to = Math.min(b + 4999, latest);
      try {
        const events = await receiver.queryFilter(receiver.filters.TaoDeposit(), b, to);
        for (const ev of events) {
          if (ev.args.sender.toLowerCase() === RECIP.toLowerCase()) {
            found.push({ ...ev.args, contract: addr });
          }
        }
      } catch {}
    }
  }

  if (found.length === 0) {
    console.log('No TaoDeposit found from ' + RECIP);
    return;
  }

  for (const f of found) {
    const nonce = f.nonce.toString();
    console.log('TaoDeposit nonce=' + nonce + ' | gross=' + ethers.formatEther(f.grossAmount) + ' TAO | net=' + ethers.formatEther(f.netAmount) + ' TAO | dest chain=' + f.destChainId.toString());
    console.log('  destToken: ' + f.destToken + ' | recipient: ' + f.recipient);

    const row = db.prepare('SELECT * FROM processed_withdrawals WHERE withdraw_nonce = ?').get(nonce);
    console.log('  DB: ' + (row ? 'done | tx=' + row.tx_hash : 'NOT IN DB'));

    if (row && row.tx_hash) {
      const latestBase = await base.getBlockNumber();
      const vault = new ethers.Contract(BASE_VAULT, VAULT_ABI, base);
      const events = await vault.queryFilter(vault.filters.Released(), latestBase - 10000, latestBase);
      const rel = events.find(e => e.args.srcNonce.toString() === nonce);
      if (rel) console.log('  Released on Base: ' + ethers.formatUnits(rel.args.amount, 6) + ' USDC | tx=' + rel.transactionHash);
      else console.log('  Released event NOT found on Base');
    }
  }
})().catch(console.error);

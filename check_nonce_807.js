require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const HASH = '0x807fc19c4fb598c0612a8fbf3160e2d74487363902957aa564156359d46ddc03';
const ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const iface = new ethers.Interface(ABI);
(async () => {
  const rc = await provider.getTransactionReceipt(HASH);
  if (!rc) { console.log('TX not found'); return; }
  for (const log of rc.logs) {
    try {
      const p = iface.parseLog(log);
      if (p) {
        const nonce = p.args.nonce.toString();
        console.log('nonce:', nonce);
        console.log('gross:', ethers.formatEther(p.args.grossAmount), 'TAO');
        console.log('net:', ethers.formatEther(p.args.netAmount), 'TAO');
        console.log('recipient:', p.args.recipient);
        const row = db.prepare('SELECT * FROM processed_withdrawals WHERE withdraw_nonce=? AND dest_chain_id=8453').get(nonce);
        console.log('DB:', row ? 'DONE tx='+row.tx_hash : 'NOT IN DB');
      }
    } catch(e) {}
  }
})().catch(console.error);

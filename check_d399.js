require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const tao = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const TAO_ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const iface = new ethers.Interface(TAO_ABI);
const HASH = '0xd399c2f5e357dc8683a17a0ede05ba46a7a2ab0cdb6edd436a9df865ed5f0ae1';

(async () => {
  const tx = await tao.getTransaction(HASH);
  const rc = await tao.getTransactionReceipt(HASH);
  if (!tx || !rc) { console.log('TX not found via RPC'); return; }
  console.log('Found! Value:', ethers.formatEther(tx.value), 'TAO | Status:', rc.status);
  for (const log of rc.logs) {
    try {
      const p = iface.parseLog(log);
      if (p) {
        const nonce = p.args.nonce.toString();
        console.log('nonce='+nonce+' gross='+ethers.formatEther(p.args.grossAmount)+' net='+ethers.formatEther(p.args.netAmount));
        console.log('destChain='+p.args.destChainId+' recipient='+p.args.recipient);
        const row = db.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=?').get(nonce);
        console.log('DB:', row ? 'DONE tx='+row.tx_hash : 'NOT IN DB');
      }
    } catch {}
  }
})().catch(console.error);

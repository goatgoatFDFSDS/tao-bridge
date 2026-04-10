require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const tao = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const TAO_ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const iface = new ethers.Interface(TAO_ABI);

async function check(hash) {
  console.log('\nTX:', hash.slice(0,14)+'...');
  const tx = await tao.getTransaction(hash);
  if (tx === null) { console.log('  NOT FOUND on chain'); return null; }
  const rc = await tao.getTransactionReceipt(hash);
  if (rc === null) { console.log('  No receipt'); return null; }
  console.log('Status:', rc.status === 1 ? 'success' : 'FAILED', '| Value:', ethers.formatEther(tx.value), 'TAO');
  for (const log of rc.logs) {
    try {
      const p = iface.parseLog(log);
      if (p) {
        const nonce = p.args.nonce.toString();
        const chain = Number(p.args.destChainId);
        const net   = ethers.formatEther(p.args.netAmount);
        const gross = ethers.formatEther(p.args.grossAmount);
        console.log('  nonce='+nonce+' gross='+gross+' net='+net+' TAO');
        console.log('  destChain='+chain+' recipient='+p.args.recipient);
        const row = db.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=? AND dest_chain_id=?').get(nonce, chain);
        console.log('  DB:', row ? 'DONE tx='+row.tx_hash : 'NOT IN DB');
        return { nonce, chain, netTao: parseFloat(net), recipient: p.args.recipient };
      }
    } catch {}
  }
  return null;
}

(async () => {
  await check('0xd67572725ce7c972df10f9af96b2f4c311a50448362d2e88c433be12e64a3935');
  await check('0xc3e4df5f1ba75d80b150cfa488e8bf09e9313c3e92b82799809c997a9b2ab640');
})().catch(console.error);

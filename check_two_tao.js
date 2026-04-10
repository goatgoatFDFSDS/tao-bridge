const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const tao = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const TAO_RECEIVER_ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const RECEIVERS = [
  '0x560f9e82e941c8dd8d6a8c75e06e4142210d6a84',
  '0x176f0a5bb9d716daa8baff3e0e0acacad7785577',
];

const hashes = [
  '0xe268fd5fa5b7a1c5450f47b7bfa111fe52fc1567ccd1087625e5250d7ef77701',
  '0xf73c2dd5611e802e82e62a64f029be52c76cf2e73af66be070668090c1f13893',
];

(async () => {
  for (const hash of hashes) {
    const tx      = await tao.getTransaction(hash);
    const receipt = await tao.getTransactionReceipt(hash);
    console.log('\nTX:', hash.slice(0,12) + '...');
    console.log('From:', tx.from, '| Value:', ethers.formatEther(tx.value), 'TAO | Status:', receipt.status === 1 ? 'success' : 'FAILED');
    const iface = new ethers.Interface(TAO_RECEIVER_ABI);
    for (const log of receipt.logs) {
      try {
        const p = iface.parseLog(log);
        if (p) {
          const nonce = p.args.nonce.toString();
          console.log('  nonce=' + nonce + ' | gross=' + ethers.formatEther(p.args.grossAmount) + ' | net=' + ethers.formatEther(p.args.netAmount) + ' TAO');
          console.log('  destChain=' + p.args.destChainId.toString() + ' | destToken=' + p.args.destToken);
          console.log('  recipient=' + p.args.recipient);
          const row = db.prepare('SELECT status, tx_hash FROM processed_withdrawals WHERE withdraw_nonce = ?').get(nonce);
          console.log('  DB:', row ? row.status + ' | tx=' + row.tx_hash : 'NOT IN DB');
        }
      } catch {}
    }
  }
})().catch(console.error);

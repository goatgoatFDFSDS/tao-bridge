const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const tao = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const HASH = '0x6d1014c080f8e52058fa14381b01f2aea2209ba7664038d6d434d468d644ed48';

const TAO_RECEIVER_ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const RECEIVERS = [
  '0x560f9e82e941c8dd8d6a8c75e06e4142210d6a84',
  '0x176f0a5bb9d716daa8baff3e0e0acacad7785577',
];

(async () => {
  const tx      = await tao.getTransaction(HASH);
  const receipt = await tao.getTransactionReceipt(HASH);

  console.log('From:  ' + tx.from);
  console.log('To:    ' + tx.to);
  console.log('Value: ' + ethers.formatEther(tx.value) + ' TAO');
  console.log('Status:' + (receipt.status === 1 ? ' success' : ' FAILED'));

  // Try to decode TaoDeposit event
  for (const addr of RECEIVERS) {
    const iface = new ethers.Interface(TAO_RECEIVER_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          const nonce = parsed.args.nonce.toString();
          console.log('\nTaoDeposit decoded:');
          console.log('  nonce=' + nonce);
          console.log('  gross=' + ethers.formatEther(parsed.args.grossAmount) + ' TAO');
          console.log('  net='   + ethers.formatEther(parsed.args.netAmount)   + ' TAO');
          console.log('  destChain=' + parsed.args.destChainId.toString());
          console.log('  destToken=' + parsed.args.destToken);
          console.log('  recipient=' + parsed.args.recipient);

          const row = db.prepare('SELECT * FROM processed_withdrawals WHERE withdraw_nonce = ?').get(nonce);
          console.log('  DB: ' + (row ? 'done | tx=' + row.tx_hash : 'NOT IN DB'));
        }
      } catch {}
    }
  }
})().catch(console.error);

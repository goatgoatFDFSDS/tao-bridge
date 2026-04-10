const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const rows = db.prepare('SELECT src_nonce, tx_hash FROM processed_deposits WHERE src_chain_id = 8453 ORDER BY CAST(src_nonce AS INTEGER)').all();

(async () => {
  for (const r of rows) {
    if (!r.tx_hash) {
      console.log('Nonce ' + r.src_nonce + ' | no tx hash');
      continue;
    }
    try {
      const tx = await provider.getTransaction(r.tx_hash);
      if (!tx) {
        console.log('Nonce ' + String(r.src_nonce).padStart(2) + ' | TX NOT FOUND on chain ❌');
        continue;
      }
      const confirmed = tx.blockNumber ? '✅' : '⏳ pending';
      console.log('Nonce ' + String(r.src_nonce).padStart(2) + ' | ' + parseFloat(ethers.formatEther(tx.value)).toFixed(6) + ' TAO → ' + tx.to.slice(0, 10) + '... | block=' + tx.blockNumber + ' ' + confirmed);
    } catch (e) {
      console.log('Nonce ' + r.src_nonce + ' | error: ' + e.message);
    }
  }
})().catch(console.error);

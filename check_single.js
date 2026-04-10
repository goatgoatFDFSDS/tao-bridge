const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const base = new ethers.JsonRpcProvider('https://base.publicnode.com');
const tao  = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const BASE_VAULT = '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063';

const hash = '0x6d1014c080f8e52058fa14381b01f2aea2209ba7664038d6d434d468d644ed48';

(async () => {
  const receipt = await base.getTransactionReceipt(hash);
  let nonce, recip, netUsd;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === BASE_VAULT) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256','uint256','uint256'], log.data);
      nonce  = decoded[2].toString();
      recip  = '0x' + log.topics[3].slice(26);
      netUsd = (Number(decoded[1]) / 1e6).toFixed(2);
    }
  }
  console.log('Nonce=' + nonce + ' | $' + netUsd + ' | Recipient: ' + recip);
  const row = db.prepare('SELECT * FROM processed_deposits WHERE src_chain_id = 8453 AND src_nonce = ?').get(nonce);
  console.log('DB: ' + (row ? row.status + ' | tx=' + (row.tx_hash || 'none') : 'NOT IN DB'));
  const bal = await tao.getBalance(recip);
  console.log('TAO balance: ' + ethers.formatEther(bal) + ' TAO');
  if (row && row.tx_hash) {
    const tx = await tao.getTransaction(row.tx_hash);
    if (tx) console.log('TAO sent: ' + ethers.formatEther(tx.value) + ' TAO');
    else console.log('TAO tx not found on chain');
  }
})().catch(console.error);

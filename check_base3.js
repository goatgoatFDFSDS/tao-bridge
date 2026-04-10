const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const base = new ethers.JsonRpcProvider('https://base.publicnode.com');
const tao  = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');

const BASE_VAULT = '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063';

const txs = [
  '0x6a192aff1863cbcb3d7d69415db9cbb86c30f094e6b3002105c65403fe0e71b1',
  '0x8c26e6c668f26938a39daf151164553d5ecdabeb3b7f9c197e99e25662fdf2b7',
  '0x7057e99924cdf9b4504aa1a5bb14773f13e891d486ee19484b65a29409e9e1e3',
];

(async () => {
  for (const hash of txs) {
    const receipt = await base.getTransactionReceipt(hash);
    if (!receipt) { console.log(hash.slice(0,10) + '... NOT FOUND'); continue; }
    let nonce, recip, netUsd;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === BASE_VAULT) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256','uint256','uint256'], log.data);
        nonce  = decoded[2].toString();
        recip  = '0x' + log.topics[3].slice(26);
        netUsd = (Number(decoded[1]) / 1e6).toFixed(2);
      }
    }
    console.log('[Base] Nonce=' + nonce + ' | $' + netUsd + ' | Recipient: ' + recip);
    const row = db.prepare('SELECT * FROM processed_deposits WHERE src_chain_id = ? AND src_nonce = ?').get(8453, nonce);
    console.log('  DB: ' + (row ? row.status + ' | tx=' + (row.tx_hash || 'none') : 'NOT IN DB'));
    if (recip) {
      const bal = await tao.getBalance(recip);
      console.log('  TAO balance: ' + ethers.formatEther(bal) + ' TAO');
      if (row && row.tx_hash) {
        const tx = await tao.getTransaction(row.tx_hash);
        if (tx) console.log('  TAO sent: ' + ethers.formatEther(tx.value) + ' TAO');
        else console.log('  TAO tx not found on chain');
      }
    }
    console.log('');
  }
})().catch(console.error);

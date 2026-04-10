const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const { usdToTaoWei } = require('./relayer/config');
const db = require('./relayer/db');
const Database = require('./node_modules/better-sqlite3');
const rawDb = new Database('./relayer.db');
const fs = require('fs');

const pk = fs.readFileSync('/Users/pro/tao-bridge/.env', 'utf8').match(/RELAYER_PRIVATE_KEY=(.+)/)[1];
const signer = new ethers.Wallet(pk, new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai'));

(async () => {
  const taoPrice = await getTaoPrice();
  console.log('TAO price: $' + taoPrice);

  const netUsd = 71.18;
  const recip  = '0xafb3a9058dabcd2f15a39feaa35877449cecb57f';
  const nonce  = '64';

  const row = rawDb.prepare('SELECT status, tx_hash FROM processed_deposits WHERE src_chain_id = 8453 AND src_nonce = ?').get(nonce);
  if (row && row.status === 'done') { console.log('Already done: ' + row.tx_hash); return; }

  const taoWei = usdToTaoWei(netUsd, taoPrice);
  console.log('Sending ' + ethers.formatEther(taoWei) + ' TAO to ' + recip);

  const tx = await signer.sendTransaction({ to: recip, value: taoWei });
  console.log('TX sent: ' + tx.hash);
  await tx.wait();
  db.markDepositProcessed(8453, nonce, tx.hash);
  console.log('Done | $' + netUsd + ' | ' + ethers.formatEther(taoWei) + ' TAO | ' + tx.hash);
})().catch(console.error);

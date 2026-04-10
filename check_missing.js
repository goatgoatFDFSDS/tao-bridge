const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');
const fs = require('fs');
const { getTaoPrice } = require('./relayer/price');
const { usdToTaoWei } = require('./relayer/config');

const base = new ethers.JsonRpcProvider('https://mainnet.base.org');
const VAULT = '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063'.toLowerCase();
const pk = fs.readFileSync('/Users/pro/tao-bridge/.env', 'utf8').match(/RELAYER_PRIVATE_KEY=(.+)/)[1];
const signer = new ethers.Wallet(pk, new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai'));

// Also process BSC nonce 0
const BSC_DEPOSIT = { chainId: 56, nonce: '0', recip: '0x67e032f22c4a856326572718417324d227884c46', netUsd: 19.8 };

(async () => {
  const taoPrice = await getTaoPrice();
  console.log('TAO price: $' + taoPrice);

  // Get all on-chain deposits
  const latest = await base.getBlockNumber();
  const contract = new ethers.Contract(VAULT, ['event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'], base);
  const events = await contract.queryFilter('Deposit', latest - 5000, latest);

  // Find unprocessed
  const rows = db.prepare('SELECT src_nonce, tx_hash, status FROM processed_deposits WHERE src_chain_id = 8453').all();
  const missing = [];
  for (const ev of events) {
    const nonce = ev.args.nonce.toString();
    const row = rows.find(r => r.src_nonce === nonce);
    if (!row || !row.tx_hash) {
      missing.push({ nonce, recip: ev.args.recipient, netUsd: Number(ev.args.netAmount) / 1e6 });
    }
  }

  console.log('Missing/no-tx nonces on Base:', missing.map(m => m.nonce).join(', ') || 'none');

  // Process missing Base deposits
  for (const d of missing) {
    const claimed = db.prepare('INSERT OR IGNORE INTO processed_deposits (src_chain_id, src_nonce, status) VALUES (?, ?, ?)').run(8453, d.nonce, 'pending');
    if (claimed.changes === 0) {
      // Already claimed, just update tx_hash
      const taoWei = usdToTaoWei(d.netUsd, taoPrice);
      const tx = await signer.sendTransaction({ to: d.recip, value: taoWei });
      await tx.wait();
      db.prepare('UPDATE processed_deposits SET tx_hash = ?, status = ? WHERE src_chain_id = ? AND src_nonce = ?').run(tx.hash, 'done', 8453, d.nonce);
      console.log('Nonce ' + d.nonce + ' | $' + d.netUsd.toFixed(2) + ' | ' + ethers.formatEther(taoWei) + ' TAO → ' + d.recip.slice(0,10) + '... | ✅');
    } else {
      const taoWei = usdToTaoWei(d.netUsd, taoPrice);
      const tx = await signer.sendTransaction({ to: d.recip, value: taoWei });
      await tx.wait();
      db.prepare('UPDATE processed_deposits SET tx_hash = ?, status = ? WHERE src_chain_id = ? AND src_nonce = ?').run(tx.hash, 'done', 8453, d.nonce);
      console.log('Nonce ' + d.nonce + ' | $' + d.netUsd.toFixed(2) + ' | ' + ethers.formatEther(taoWei) + ' TAO → ' + d.recip.slice(0,10) + '... | ✅');
    }
  }

  // Process BSC nonce 0
  const bscRow = db.prepare('SELECT * FROM processed_deposits WHERE src_chain_id = 56 AND src_nonce = ?').get('0');
  if (!bscRow) {
    console.log('Processing BSC nonce 0...');
    db.prepare('INSERT OR IGNORE INTO processed_deposits (src_chain_id, src_nonce, status) VALUES (?, ?, ?)').run(56, '0', 'pending');
    const taoWei = usdToTaoWei(BSC_DEPOSIT.netUsd, taoPrice);
    const tx = await signer.sendTransaction({ to: BSC_DEPOSIT.recip, value: taoWei });
    await tx.wait();
    db.prepare('UPDATE processed_deposits SET tx_hash = ?, status = ? WHERE src_chain_id = ? AND src_nonce = ?').run(tx.hash, 'done', 56, '0');
    console.log('BSC Nonce 0 | $19.80 | ' + ethers.formatEther(taoWei) + ' TAO → ' + BSC_DEPOSIT.recip.slice(0,10) + '... | ✅');
  } else {
    console.log('BSC Nonce 0 already in DB:', bscRow.tx_hash || 'no tx hash');
  }

  if (missing.length === 0) console.log('All Base deposits already processed ✅');
  console.log('Done!');
})().catch(console.error);

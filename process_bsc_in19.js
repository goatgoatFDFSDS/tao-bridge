require('dotenv').config();
const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const rawDb = require('./node_modules/better-sqlite3')('./relayer.db');

const taoProvider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const taoSigner = new ethers.Wallet(process.env.TAO_RELAYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY, taoProvider);

(async () => {
  const already = rawDb.prepare('SELECT * FROM processed_deposits WHERE src_chain_id=56 AND src_nonce=?').get('19');
  if (already && already.status === 'done') { console.log('Already done:', already.tx_hash); return; }

  const taoPrice = await getTaoPrice();
  const netUsdt = 39.6;
  const taoAmt = netUsdt / taoPrice;
  const taoWei = ethers.parseEther(taoAmt.toFixed(18));
  const recip = ethers.getAddress('0xa7a27ace3b01a6a4c4a563b92b5c17de42c2487f');

  const bal = await taoProvider.getBalance(taoSigner.address);
  console.log('Relayer TAO balance:', ethers.formatEther(bal));
  console.log('Sending', ethers.formatEther(taoWei), 'TAO to', recip, '@ $'+taoPrice);

  const tx = await taoSigner.sendTransaction({ to: recip, value: taoWei });
  console.log('TX:', tx.hash);
  await tx.wait();

  rawDb.prepare('INSERT OR REPLACE INTO processed_deposits (src_chain_id, src_nonce, tx_hash, processed_at, status) VALUES (56, 19, ?, ?, \'done\')').run(tx.hash, Math.floor(Date.now()/1000));
  console.log('Done ✓');
})().catch(console.error);

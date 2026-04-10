require('dotenv').config();
const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const { usdToTaoWei } = require('./relayer/config');
const db = require('./relayer/db');
const rawDb = require('./node_modules/better-sqlite3')('./relayer.db');

const taoSigner = new ethers.Wallet(
  process.env.RELAYER_PRIVATE_KEY,
  new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai')
);
const baseSigner = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY,
  new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org')
);

const BASE_VAULT = ethers.getAddress('0xfb5b153b5c5b86b96a0d33d08b2bdf58d6a9571d');
const USDC_BASE  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const VAULT_ABI  = ['function release(address token, address recipient, uint256 amount, uint256 srcNonce) external'];

(async () => {
  const taoPrice = await getTaoPrice();
  console.log('TAO price: $' + taoPrice);

  // ── [1] Base nonce 63 → send TAO ──────────────────────────────────────────
  const dep63 = { nonce: '63', netUsd: 49.995878, recip: '0xf1A577a722fDA3A7E74203AB377e2d06791231B2' };
  db.claimDeposit(8453, dep63.nonce);
  const row63 = rawDb.prepare('SELECT status FROM processed_deposits WHERE src_chain_id=8453 AND src_nonce=?').get(dep63.nonce);
  if (row63?.status === 'done') {
    console.log('[63] Already done — skip');
  } else {
    const taoWei = usdToTaoWei(dep63.netUsd, taoPrice);
    console.log('[63] Sending', ethers.formatEther(taoWei), 'TAO to', dep63.recip);
    const tx = await taoSigner.sendTransaction({ to: dep63.recip, value: taoWei });
    console.log('[63] TX:', tx.hash);
    await tx.wait();
    db.markDepositProcessed(8453, dep63.nonce, tx.hash);
    console.log('[63] Done ✓');
  }

  // ── [3] Base nonce 99 → send TAO ──────────────────────────────────────────
  const dep99 = { nonce: '99', netUsd: 5.841, recip: '0x8B3Ec4E4bbCc986fFe7C620f6fE6a316b9cCb738' };
  db.claimDeposit(8453, dep99.nonce);
  const row99 = rawDb.prepare('SELECT status FROM processed_deposits WHERE src_chain_id=8453 AND src_nonce=?').get(dep99.nonce);
  if (row99?.status === 'done') {
    console.log('[99] Already done — skip');
  } else {
    const taoWei = usdToTaoWei(dep99.netUsd, taoPrice);
    console.log('[99] Sending', ethers.formatEther(taoWei), 'TAO to', dep99.recip);
    const tx = await taoSigner.sendTransaction({ to: dep99.recip, value: taoWei });
    console.log('[99] TX:', tx.hash);
    await tx.wait();
    db.markDepositProcessed(8453, dep99.nonce, tx.hash);
    console.log('[99] Done ✓');
  }

  // ── [4] Bridge OUT nonce 10 → send USDC on Base ───────────────────────────
  // gross=0.155 TAO, net=0.14725 TAO, recipient=0x9334164D6810BA01e52A147fe0aD36FA0A37ff1f
  const out10 = { nonce: '10', netTao: 0.14725, recip: '0x9334164D6810BA01e52A147fe0aD36FA0A37ff1f' };
  const alreadyDone = rawDb.prepare('SELECT tx_hash FROM processed_withdrawals WHERE withdraw_nonce=? AND dest_chain_id=8453').get(out10.nonce);
  if (alreadyDone) {
    console.log('[OUT-10] Already done tx='+alreadyDone.tx_hash);
  } else {
    const usdAmount = out10.netTao * taoPrice;
    const usdcAmount = ethers.parseUnits(usdAmount.toFixed(6), 6);
    console.log('[OUT-10] Releasing', ethers.formatUnits(usdcAmount, 6), 'USDC → ', out10.recip);
    const vault = new ethers.Contract(BASE_VAULT, VAULT_ABI, baseSigner);
    const tx = await vault.release(USDC_BASE, out10.recip, usdcAmount, 10);
    console.log('[OUT-10] TX:', tx.hash);
    await tx.wait();
    rawDb.prepare('INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash) VALUES (?,8453,?)').run(out10.nonce, tx.hash);
    console.log('[OUT-10] Done ✓');
  }
})().catch(console.error);

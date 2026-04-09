/**
 * sourceListener.js
 * Watches BridgeVault.Deposit events on ETH / Base / BSC
 * → fetches TAO price → sends native TAO to recipient on Bittensor EVM
 */
const { ethers } = require('ethers');
const { CONFIRMATIONS, BITTENSOR_CHAIN, toUSD, usdToTaoWei, getTokenDecimals } = require('./config');
const { getTaoPrice } = require('./price');
const db = require('./db');
const { claimDeposit } = db;

const VAULT_ABI = [
  'event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
];

async function processDeposit(chainCfg, event, bittensorSigner) {
  const { chainId, name } = chainCfg;
  const { token, sender, recipient, grossAmount, netAmount, nonce } = event.args;
  const srcNonce = nonce.toString();

  // Atomically claim this nonce — prevents double-send if two relayer instances run
  if (!db.claimDeposit(chainId, srcNonce)) {
    console.log(`[${name}] Nonce ${srcNonce} already claimed — skip`);
    return;
  }

  const decimals = getTokenDecimals(chainId, token);
  if (decimals === null) {
    console.warn(`[${name}] Unknown token ${token} — skip`);
    return;
  }

  // Use grossAmount for threshold check so $500 deposits are never auto-processed
  const grossUsd = toUSD(grossAmount, decimals);

  // Large deposits (>= $300 gross) are processed manually — leave as pending
  if (grossUsd >= 300) {
    console.log(`[${name}] Nonce ${srcNonce} | $${grossUsd.toFixed(2)} gross >= $300 — held for manual processing`);
    db.markDepositPending(chainId, srcNonce);
    return;
  }

  // Use netAmount (after fee) to calculate TAO to send
  const usd = toUSD(netAmount, decimals);
  let taoPrice;
  try {
    taoPrice = await getTaoPrice();
  } catch (err) {
    console.error(`[${name}] Price fetch failed:`, err.message);
    db.addPending('deposit', { chainId, token, sender, recipient, amount: netAmount.toString(), srcNonce });
    return;
  }

  const taoWei = usdToTaoWei(usd, taoPrice);

  console.log(
    `[${name}] Deposit nonce=${srcNonce} | net $${usd.toFixed(2)} (after 1% fee) | TAO price=$${taoPrice} | → ${ethers.formatEther(taoWei)} TAO → ${recipient}`
  );

  try {
    const tx = await bittensorSigner.sendTransaction({
      to:    recipient,
      value: taoWei,
    });
    console.log(`[${name}→Bittensor] TAO tx sent: ${tx.hash}`);
    await tx.wait();
    db.markDepositProcessed(chainId, srcNonce, tx.hash);
    console.log(`[${name}→Bittensor] ✓ ${ethers.formatEther(taoWei)} TAO sent to ${recipient} (nonce ${srcNonce})`);
  } catch (err) {
    console.error(`[${name}→Bittensor] Send TAO failed:`, err.message);
    db.addPending('deposit', { chainId, token, sender, recipient, amount: netAmount.toString(), srcNonce });
  }
}

async function pollSourceChain(chainCfg, bittensorSigner) {
  const { name, chainId, rpc, vaultAddress } = chainCfg;
  if (!vaultAddress) { console.warn(`[${name}] No vault address configured — skip`); return; }

  let provider;
  try {
    provider = new ethers.JsonRpcProvider(rpc);
  } catch {
    console.error(`[${name}] Provider init failed`);
    return;
  }

  const vault        = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
  const confirmations = CONFIRMATIONS[chainId];

  let fromBlock = db.getLastBlock(chainId);
  if (fromBlock === 0) {
    const latest  = await provider.getBlockNumber();
    fromBlock = Math.max(0, latest - 1000);
    db.setLastBlock(chainId, fromBlock);
  }

  try {
    const latest    = await provider.getBlockNumber();
    const safeBlock = latest - confirmations;
    if (safeBlock <= fromBlock) return;

    const toBlock = Math.min(safeBlock, fromBlock + 2000);
    const events  = await vault.queryFilter(vault.filters.Deposit(), fromBlock + 1, toBlock);

    if (events.length > 0)
      console.log(`[${name}] ${events.length} Deposit event(s) in blocks ${fromBlock + 1}–${toBlock}`);

    for (const ev of events) await processDeposit(chainCfg, ev, bittensorSigner);

    db.setLastBlock(chainId, toBlock);
  } catch (err) {
    console.error(`[${name}] Poll error:`, err.message);
  }
}

module.exports = { pollSourceChain };

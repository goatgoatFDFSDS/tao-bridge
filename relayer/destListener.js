/**
 * destListener.js
 * Watches TaoReceiver.TaoDeposit events on Bittensor EVM
 * → fetches TAO price → releases USDC/USDT on destination chain
 */
const { ethers } = require('ethers');
const { CONFIRMATIONS, BITTENSOR_CHAIN, SOURCE_CHAINS, taoWeiToUSD, usdToStable, getTokenDecimals } = require('./config');
const { getTaoPrice } = require('./price');
const db = require('./db');

const MANUAL_THRESHOLD_TAO = ethers.parseEther('0.9');

const TAO_RECEIVER_ABI = [
  'event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
];

const VAULT_ABI = [
  'function release(address token, address recipient, uint256 amount, uint256 srcNonce) external',
];

const vaultContracts = {};

async function processWithdrawal(event, sourceSigners) {
  const { sender, recipient, destChainId, destToken, grossAmount, netAmount, nonce } = event.args;
  const withdrawNonce  = nonce.toString();
  const destChainNum   = Number(destChainId);

  if (db.isWithdrawalProcessed(withdrawNonce)) return;

  // Large withdrawals (>= 0.9 TAO gross) are held for manual processing
  if (grossAmount >= MANUAL_THRESHOLD_TAO) {
    console.log(`[Bittensor] Nonce ${withdrawNonce} | ${ethers.formatEther(grossAmount)} TAO gross >= 0.9 — held for manual processing`);
    db.markWithdrawalManual(withdrawNonce, Number(destChainId));
    return;
  }

  // Queue with 24h delay (TAO price volatility protection)
  db.markWithdrawalQueued(withdrawNonce, destChainNum, {
    destToken: destToken.toString(),
    recipient: recipient.toString(),
    netAmount: netAmount.toString(),
    grossAmount: grossAmount.toString(),
  });
  console.log(`[Bittensor] Nonce ${withdrawNonce} | ${ethers.formatEther(grossAmount)} TAO gross — queued, will release in 24h`);
}

async function releaseWithdrawal(withdrawNonce, destChainNum, data, sourceSigners) {
  const { destToken, recipient, netAmount } = data;

  const destChainCfg = SOURCE_CHAINS.find(c => c.chainId === destChainNum);
  if (!destChainCfg) {
    console.error(`[Bittensor] Unknown dest chain ${destChainNum} for nonce ${withdrawNonce}`);
    return;
  }

  const decimals = getTokenDecimals(destChainNum, destToken);
  if (decimals === null) {
    console.error(`[Bittensor] Unknown token ${destToken} on chain ${destChainNum}`);
    return;
  }

  let taoPrice;
  try {
    taoPrice = await getTaoPrice();
  } catch (err) {
    console.error(`[Bittensor] Price fetch failed for queued nonce ${withdrawNonce}:`, err.message);
    return; // will retry on next poll
  }

  const usd       = taoWeiToUSD(BigInt(netAmount), taoPrice);
  const stableRaw = usdToStable(usd, decimals);

  console.log(
    `[Bittensor→${destChainCfg.name}] Releasing queued nonce=${withdrawNonce} | net ${ethers.formatEther(BigInt(netAmount))} TAO | $${usd.toFixed(2)} | → ${ethers.formatUnits(stableRaw, decimals)} stable → ${recipient}`
  );

  const signer = sourceSigners[destChainNum];
  if (!signer) {
    console.error(`[Bittensor] No signer for chain ${destChainNum}`);
    return;
  }

  if (!vaultContracts[destChainNum]) {
    vaultContracts[destChainNum] = new ethers.Contract(
      destChainCfg.vaultAddress, VAULT_ABI, signer
    );
  }

  try {
    const vault = vaultContracts[destChainNum];
    const tx    = await vault.release(destToken, recipient, stableRaw, withdrawNonce);
    console.log(`[Bittensor→${destChainCfg.name}] release tx: ${tx.hash}`);
    await tx.wait();
    db.markWithdrawalDone(withdrawNonce, tx.hash);
    console.log(`[Bittensor→${destChainCfg.name}] ✓ ${ethers.formatUnits(stableRaw, decimals)} released to ${recipient} (nonce ${withdrawNonce})`);
  } catch (err) {
    console.error(`[Bittensor→${destChainCfg.name}] release failed for nonce ${withdrawNonce}:`, err.message);
    // stays as 'queued', will retry next poll
  }
}

async function processReadyWithdrawals(sourceSigners) {
  const ready = db.getReadyWithdrawals();
  if (ready.length === 0) return;
  console.log(`[Bittensor] ${ready.length} queued withdrawal(s) ready to release (24h elapsed)`);
  for (const row of ready) {
    await releaseWithdrawal(row.withdraw_nonce, row.dest_chain_id, row.data, sourceSigners);
  }
}

async function pollBittensor(sourceSigners) {
  const { rpc, taoReceiverAddress, chainId } = BITTENSOR_CHAIN;
  if (!taoReceiverAddress) { console.warn('[Bittensor] No TaoReceiver address configured'); return; }

  const confirmations = CONFIRMATIONS[chainId];
  let provider;
  try {
    provider = new ethers.JsonRpcProvider(rpc);
  } catch {
    console.error('[Bittensor] Provider init failed');
    return;
  }

  const receiver = new ethers.Contract(taoReceiverAddress, TAO_RECEIVER_ABI, provider);

  let fromBlock = db.getLastBlock(chainId);
  if (fromBlock === 0) {
    const latest = await provider.getBlockNumber();
    fromBlock    = Math.max(0, latest - 1000);
    db.setLastBlock(chainId, fromBlock);
  }

  try {
    // Process any withdrawals that have been queued for >= 24h
    await processReadyWithdrawals(sourceSigners);

    const latest    = await provider.getBlockNumber();
    const safeBlock = latest - confirmations;
    if (safeBlock <= fromBlock) return;

    const toBlock = Math.min(safeBlock, fromBlock + 2000);
    const events  = await receiver.queryFilter(receiver.filters.TaoDeposit(), fromBlock + 1, toBlock);

    if (events.length > 0)
      console.log(`[Bittensor] ${events.length} TaoDeposit event(s) in blocks ${fromBlock + 1}–${toBlock}`);

    for (const ev of events) await processWithdrawal(ev, sourceSigners);

    db.setLastBlock(chainId, toBlock);
  } catch (err) {
    console.error('[Bittensor] Poll error:', err.message);
  }
}

module.exports = { pollBittensor };

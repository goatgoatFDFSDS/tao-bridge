/**
 * passSync.js
 * Syncs TAOflow Pass holders to BridgeVault.feeWaivers on all source chains.
 *
 * How it works:
 *  1. Read Transfer events from TAOflowPass on Bittensor EVM to find all current holders.
 *  2. For each source chain vault, call setFeeWaivers(holders, true) via relayer signer.
 *  3. Runs once at startup, then every SYNC_INTERVAL_MS.
 *
 * The relayer wallet must be set as `relayer` on each BridgeVault (already the case).
 */

'use strict';

const { ethers } = require('ethers');
const { SOURCE_CHAINS, BITTENSOR_CHAIN } = require('./config');

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

const PASS_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function balanceOf(address owner) view returns (uint256)',
];

const VAULT_ABI = [
  'function feeWaivers(address) view returns (bool)',
  'function setFeeWaivers(address[] calldata wallets, bool exempt) external',
];

/**
 * Fetch all current TAOflow Pass holders by scanning Transfer events.
 * Returns a Set of lowercase addresses.
 */
async function fetchPassHolders(passAddress) {
  const provider = new ethers.JsonRpcProvider(BITTENSOR_CHAIN.rpc);
  const pass     = new ethers.Contract(passAddress, PASS_ABI, provider);

  const latest   = await provider.getBlockNumber();
  const CHUNK    = 5000;
  let   fromBlock = Math.max(0, latest - 200_000); // scan last ~200k blocks

  const owners = new Map(); // tokenId → owner

  while (fromBlock < latest) {
    const toBlock = Math.min(fromBlock + CHUNK, latest);
    const events  = await pass.queryFilter(pass.filters.Transfer(), fromBlock, toBlock);
    for (const ev of events) {
      owners.set(ev.args.tokenId.toString(), ev.args.to.toLowerCase());
    }
    fromBlock = toBlock + 1;
  }

  // Unique holders (exclude burn address)
  const holders = new Set(
    [...owners.values()].filter(a => a !== '0x0000000000000000000000000000000000000000')
  );

  return holders;
}

/**
 * Update feeWaivers on a single BridgeVault.
 * Only calls setFeeWaivers for addresses not yet exempted.
 */
async function syncVault(chainCfg, holders, relayerSigner) {
  const { name, rpc, vaultAddress } = chainCfg;
  if (!vaultAddress) {
    console.log(`[passSync][${name}] No vault address — skip`);
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const vault    = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
  const signer   = relayerSigner.connect(provider);

  // Filter out already-exempted addresses to save gas
  const toAdd = [];
  for (const holder of holders) {
    const already = await vault.feeWaivers(holder);
    if (!already) toAdd.push(holder);
  }

  if (toAdd.length === 0) {
    console.log(`[passSync][${name}] All ${holders.size} holders already exempted`);
    return;
  }

  console.log(`[passSync][${name}] Granting fee waiver to ${toAdd.length} new holder(s)…`);

  // Send in batches of 100 to avoid gas limit
  const BATCH = 100;
  for (let i = 0; i < toAdd.length; i += BATCH) {
    const batch = toAdd.slice(i, i + BATCH);
    try {
      const tx = await vault.connect(signer).setFeeWaivers(batch, true);
      await tx.wait();
      console.log(`[passSync][${name}] ✓ Batch ${Math.floor(i / BATCH) + 1} — TX ${tx.hash}`);
    } catch (err) {
      console.error(`[passSync][${name}] Batch failed:`, err.message);
    }
  }
}

/**
 * Main sync — call once to run immediately, then set up interval.
 */
async function syncPassHolders(relayerSigner) {
  const passAddress = process.env.PASS_CONTRACT;
  if (!passAddress) {
    console.log('[passSync] PASS_CONTRACT not set — fee waiver sync disabled');
    return;
  }

  console.log('[passSync] Fetching TAOflow Pass holders…');
  let holders;
  try {
    holders = await fetchPassHolders(passAddress);
    console.log(`[passSync] Found ${holders.size} pass holder(s)`);
  } catch (err) {
    console.error('[passSync] Failed to fetch holders:', err.message);
    return;
  }

  if (holders.size === 0) return;

  for (const chainCfg of SOURCE_CHAINS) {
    await syncVault(chainCfg, holders, relayerSigner);
  }
}

/**
 * Start the sync loop. Call this from relayer/index.js after signer is ready.
 */
function startPassSync(relayerSigner) {
  // Run immediately, then on interval
  syncPassHolders(relayerSigner).catch(err =>
    console.error('[passSync] Sync error:', err.message)
  );
  setInterval(() => {
    syncPassHolders(relayerSigner).catch(err =>
      console.error('[passSync] Sync error:', err.message)
    );
  }, SYNC_INTERVAL_MS);
}

module.exports = { startPassSync };

require('dotenv').config();
const { ethers }             = require('ethers');
const { SOURCE_CHAINS, BITTENSOR_CHAIN, POLL_INTERVAL, toUSD, usdToStable, taoWeiToUSD, getTokenDecimals } = require('./config');
const { pollSourceChain }    = require('./sourceListener');
const { pollBittensor }      = require('./destListener');
const { getTaoPrice }        = require('./price');
const { startPassSync }      = require('./passSync');
const db                     = require('./db');

const VAULT_ABI = [
  'function release(address token, address recipient, uint256 amount, uint256 srcNonce) external',
];

function buildSigners() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error('RELAYER_PRIVATE_KEY not set in .env');

  const bittensorProvider = new ethers.JsonRpcProvider(BITTENSOR_CHAIN.rpc);
  const bittensorSigner   = new ethers.Wallet(pk, bittensorProvider);

  const sourceSigners = {};
  for (const chain of SOURCE_CHAINS) {
    if (!chain.rpc) { console.warn(`[${chain.name}] No RPC configured`); continue; }
    const provider = new ethers.JsonRpcProvider(chain.rpc);
    sourceSigners[chain.chainId] = new ethers.Wallet(pk, provider);
  }

  return { bittensorSigner, sourceSigners };
}

async function retryPending(bittensorSigner, sourceSigners) {
  const pending = db.getPending(10);
  if (pending.length === 0) return;

  console.log(`[Retry] ${pending.length} pending item(s)...`);
  let taoPrice;
  try { taoPrice = await getTaoPrice(); } catch { return; }

  for (const item of pending) {
    try {
      if (item.type === 'deposit') {
        const { chainId, token, recipient, amount, srcNonce } = item.data;
        if (db.isDepositProcessed(chainId, srcNonce)) { db.removePending(item.id); continue; }

        const decimals = getTokenDecimals(chainId, token);
        const usd      = toUSD(BigInt(amount), decimals);
        const { usdToTaoWei } = require('./config');
        const taoWei   = usdToTaoWei(usd, taoPrice);

        const tx = await bittensorSigner.sendTransaction({ to: recipient, value: taoWei });
        await tx.wait();
        db.markDepositProcessed(chainId, srcNonce, tx.hash);
        db.removePending(item.id);
        console.log(`[Retry] deposit nonce ${srcNonce} done ✓`);

      } else if (item.type === 'withdrawal') {
        const { destChainId, destToken, recipient, taoWei, withdrawNonce } = item.data;
        if (db.isWithdrawalProcessed(withdrawNonce)) { db.removePending(item.id); continue; }

        const decimals  = getTokenDecimals(destChainId, destToken);
        const usd       = taoWeiToUSD(BigInt(taoWei), taoPrice);
        const stableRaw = usdToStable(usd, decimals);
        const signer    = sourceSigners[destChainId];
        if (!signer) continue;

        const chain = SOURCE_CHAINS.find(c => c.chainId === destChainId);
        const vault = new ethers.Contract(chain.vaultAddress, VAULT_ABI, signer);
        const tx    = await vault.release(destToken, recipient, stableRaw, withdrawNonce);
        await tx.wait();
        db.markWithdrawalProcessed(withdrawNonce, destChainId, tx.hash);
        db.removePending(item.id);
        console.log(`[Retry] withdrawal nonce ${withdrawNonce} done ✓`);
      }
    } catch (err) {
      console.error(`[Retry] item ${item.id} failed:`, err.message);
      db.incrementAttempts(item.id, err.message);
    }
  }
}

async function printBalances(bittensorSigner, sourceSigners) {
  const taoPrice = await getTaoPrice().catch(() => null);
  const taoBal   = await bittensorSigner.provider.getBalance(bittensorSigner.address);
  console.log(`\nRelayer balances:`);
  console.log(`  Bittensor EVM : ${ethers.formatEther(taoBal)} TAO${taoPrice ? ` (~$${(Number(ethers.formatEther(taoBal)) * taoPrice).toFixed(2)})` : ''}`);
  for (const chain of SOURCE_CHAINS) {
    const signer = sourceSigners[chain.chainId];
    if (!signer) continue;
    const bal = await signer.provider.getBalance(signer.address);
    console.log(`  ${chain.name.padEnd(10)}: ${ethers.formatEther(bal)} ${chain.chainId === 56 ? 'BNB' : 'ETH'}`);
  }
  console.log('');
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   TAOflow Bridge Relayer — Mainnet');
  console.log('═══════════════════════════════════════════════════');

  const { bittensorSigner, sourceSigners } = buildSigners();
  console.log(`Relayer address : ${bittensorSigner.address}`);
  console.log(`Bittensor RPC   : ${BITTENSOR_CHAIN.rpc}`);
  console.log(`TaoReceiver     : ${BITTENSOR_CHAIN.taoReceiverAddress || 'NOT SET'}`);
  console.log(`Monitoring      : ${SOURCE_CHAINS.map(c => c.name).join(', ')}`);
  console.log(`Poll interval   : ${POLL_INTERVAL / 1000}s`);

  await printBalances(bittensorSigner, sourceSigners);

  // Sync TAOflow Pass holders → fee waivers on all BridgeVaults (every 10 min)
  startPassSync(bittensorSigner);

  async function tick() {
    await Promise.allSettled(
      SOURCE_CHAINS.map(chain => pollSourceChain(chain, bittensorSigner))
    );
    await pollBittensor(sourceSigners);
    await retryPending(bittensorSigner, sourceSigners);
  }

  // Print balances every 5 minutes
  setInterval(() => printBalances(bittensorSigner, sourceSigners), 5 * 60_000);

  const safeTick = () => tick().catch(err => console.error('[Tick] Unhandled error:', err.message));

  await safeTick();
  setInterval(safeTick, POLL_INTERVAL);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

require('dotenv').config();
const { ethers } = require('ethers');

const BASE_RPC = process.env.BASE_RPC || 'https://mainnet.base.org';
const BSC_RPC  = process.env.BSC_RPC  || 'https://bsc.publicnode.com';
const VAULT    = '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063';
const ABI      = ['event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];

const baseProvider = new ethers.JsonRpcProvider(BASE_RPC);
const bscProvider  = new ethers.JsonRpcProvider(BSC_RPC);
const USDT_BSC = '0x55d398326f99059ff775485246999027b3197955';

// Timestamps from DB
// Base nonces 13/15/17/18/19: ~1775522026 (Base ~2s blocks)
// BSC nonce 12: 1775536608 (BSC ~3s blocks)
// Current time ~1775570000
// Base: diff = ~48000s / 2s = ~24000 blocks back from current 44393021 → ~44369000
// BSC: diff = ~33000s / 3s = ~11000 blocks back from current 91160000 → ~91149000

async function findNonces(provider, chainName, nonces, startBlock, batchSize = 5000) {
  const vault = new ethers.Contract(VAULT, ABI, provider);
  const current = await provider.getBlockNumber();
  const found = {};
  // Search around the estimated block ± 5000
  const ranges = [
    [startBlock - 5000, startBlock + 5000],
    [startBlock - 15000, startBlock - 5001],
    [startBlock + 5001, startBlock + 15000],
  ];
  for (const [from, to] of ranges) {
    if (Object.keys(found).length === nonces.length) break;
    const f = Math.max(0, from);
    const t = Math.min(current, to);
    for (let b = f; b < t; b += batchSize) {
      try {
        const events = await vault.queryFilter(vault.filters.Deposit(), b, Math.min(b + batchSize - 1, t));
        for (const ev of events) {
          const n = Number(ev.args.nonce);
          if (nonces.includes(n) && !found[n]) {
            const dec = ev.args.token.toLowerCase() === USDT_BSC ? 18 : 6;
            const gross = parseFloat(ethers.formatUnits(ev.args.grossAmount, dec));
            const net   = parseFloat(ethers.formatUnits(ev.args.netAmount, dec));
            found[n] = { gross, net, recipient: ev.args.recipient, token: ev.args.token, block: ev.blockNumber };
          }
        }
      } catch(e) { process.stdout.write('.'); }
    }
  }
  for (const n of nonces) {
    if (found[n]) {
      const f = found[n];
      console.log(`[${chainName}] Nonce ${n} | $${f.gross.toFixed(2)} gross / $${f.net.toFixed(2)} net | recipient: ${f.recipient} | block: ${f.block}`);
    } else {
      console.log(`[${chainName}] Nonce ${n} | NOT FOUND`);
    }
  }
}

(async () => {
  const [baseBlock, bscBlock] = await Promise.all([baseProvider.getBlockNumber(), bscProvider.getBlockNumber()]);
  console.log('Current Base block:', baseBlock, '| BSC block:', bscBlock);
  // Base nonces at ~1775522026, current ~1775570000 => ~48000s ago => ~24000 Base blocks ago
  const baseTarget = baseBlock - 24000;
  // BSC nonce 12 at 1775536608, current ~1775570000 => ~33400s ago => ~11100 BSC blocks ago
  const bscTarget = bscBlock - 11100;
  console.log('Searching Base around block', baseTarget, '| BSC around', bscTarget);
  await Promise.all([
    findNonces(baseProvider, 'BASE', [13, 15, 17, 18, 19], baseTarget),
    findNonces(bscProvider,  'BSC',  [12], bscTarget),
  ]);
})().catch(console.error);

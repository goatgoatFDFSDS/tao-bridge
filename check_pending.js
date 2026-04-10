require('dotenv').config();
const { ethers } = require('ethers');

const BASE_RPC = process.env.BASE_RPC || 'https://mainnet.base.org';
const BSC_RPC  = process.env.BSC_RPC  || 'https://bsc.publicnode.com';
const VAULT    = '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063';
const ABI      = ['event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];

const baseProvider = new ethers.JsonRpcProvider(BASE_RPC);
const bscProvider  = new ethers.JsonRpcProvider(BSC_RPC);
const USDT_BSC = '0x55d398326f99059ff775485246999027b3197955';

async function findNonces(provider, chainName, nonces, batchSize = 40000) {
  const vault = new ethers.Contract(VAULT, ABI, provider);
  const current = await provider.getBlockNumber();
  const found = {};
  let to = current;
  let from = to - batchSize;
  const maxSearch = 300000;
  let searched = 0;
  while (searched < maxSearch && Object.keys(found).length < nonces.length) {
    try {
      const events = await vault.queryFilter(vault.filters.Deposit(), from, to);
      for (const ev of events) {
        const n = Number(ev.args.nonce);
        if (nonces.includes(n) && !found[n]) {
          const dec = ev.args.token.toLowerCase() === USDT_BSC ? 18 : 6;
          const gross = parseFloat(ethers.formatUnits(ev.args.grossAmount, dec));
          const net   = parseFloat(ethers.formatUnits(ev.args.netAmount, dec));
          found[n] = { n, gross, net, recipient: ev.args.recipient, token: ev.args.token };
        }
      }
    } catch(e) {}
    to = from - 1;
    from = to - batchSize;
    searched += batchSize;
  }
  for (const n of nonces) {
    if (found[n]) {
      const f = found[n];
      console.log(`[${chainName}] Nonce ${f.n} | gross: $${f.gross.toFixed(2)} | net: $${f.net.toFixed(2)} | recipient: ${f.recipient}`);
    } else {
      console.log(`[${chainName}] Nonce ${n} | NOT FOUND`);
    }
  }
}

(async () => {
  await Promise.all([
    findNonces(baseProvider, 'BASE', [13, 15, 17, 18, 19]),
    findNonces(bscProvider,  'BSC',  [12]),
  ]);
})().catch(console.error);

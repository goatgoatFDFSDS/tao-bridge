require('dotenv').config();
const { ethers } = require('ethers');

const CHAINS = [
  { id: 1,    name: 'ETH',  rpc: process.env.ETH_RPC  || 'https://ethereum.publicnode.com', vault: '0x6eC196A4330d6F48Fa7f2f908b1F6CCebe9E6Fcb', tokens: [{sym:'USDC',addr:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',dec:6},{sym:'USDT',addr:'0xdAC17F958D2ee523a2206206994597C13D831ec7',dec:6}], lookback:50000, chunk:2000 },
  { id: 8453, name: 'Base', rpc: process.env.BASE_RPC || 'https://mainnet.base.org',         vault: '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063', tokens: [{sym:'USDC',addr:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',dec:6}], lookback:200000, chunk:5000 },
  { id: 56,   name: 'BSC',  rpc: process.env.BSC_RPC  || 'https://bsc.publicnode.com',       vault: '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063', tokens: [{sym:'USDC',addr:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',dec:18}], lookback:100000, chunk:2000 },
];

const TAO_RECEIVERS = [
  { addr: '0x560F9e82e941C8dD8D6A8c75e06E4142210d6a84', fee: 100 },
  { addr: '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577', fee: 500 },
];

const VAULT_ABI = ['event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const TAO_ABI   = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];

async function queryChunked(contract, filter, fromBlock, toBlock, chunk) {
  const events = [];
  for (let f = fromBlock; f <= toBlock; f += chunk) {
    const t = Math.min(f + chunk - 1, toBlock);
    try { events.push(...await contract.queryFilter(filter, f, t)); } catch {}
  }
  return events;
}

(async () => {
  const TAO_PRICE = 312;
  let grandGrossIn = 0, grandTxsIn = 0;
  let grandGrossOut = 0, grandTxsOut = 0;

  const L = '─'.repeat(60);
  const rows = [];

  // Bridge IN
  for (const c of CHAINS) {
    const provider = new ethers.JsonRpcProvider(c.rpc);
    const latest = await provider.getBlockNumber();
    const from = Math.max(0, latest - c.lookback);
    const vault = new ethers.Contract(ethers.getAddress(c.vault.toLowerCase()), VAULT_ABI, provider);

    for (const tk of c.tokens) {
      const evs = await queryChunked(vault, vault.filters.Deposit(ethers.getAddress(tk.addr.toLowerCase())), from, latest, c.chunk);
      let gross = 0;
      for (const ev of evs) gross += parseFloat(ethers.formatUnits(ev.args.grossAmount, tk.dec));
      if (evs.length > 0) {
        rows.push({ dir:'IN', chain:c.name, token:tk.sym, txs:evs.length, gross, grossUSD: gross });
        grandGrossIn += gross;
        grandTxsIn   += evs.length;
      }
    }
  }

  // Bridge OUT
  const taoProvider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
  const latest964 = await taoProvider.getBlockNumber();
  for (const r of TAO_RECEIVERS) {
    const rec = new ethers.Contract(r.addr, TAO_ABI, taoProvider);
    const from = Math.max(0, latest964 - 200000);
    const evs = await queryChunked(rec, rec.filters.TaoDeposit(), from, latest964, 2000);
    let grossTAO = 0;
    for (const ev of evs) grossTAO += parseFloat(ethers.formatEther(ev.args.grossAmount));
    if (evs.length > 0) {
      const grossUSD = grossTAO * TAO_PRICE;
      rows.push({ dir:'OUT', chain:'Bittensor→EVM', token:'TAO', txs:evs.length, gross:grossTAO, grossUSD });
      grandGrossOut += grossUSD;
      grandTxsOut   += evs.length;
    }
  }

  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║   TAOFLOW BRIDGE — VOLUME RECAP' + ' '.repeat(26) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  console.log(' ' + L);
  console.log(` ${'Dir'.padEnd(5)} ${'Chain'.padEnd(14)} ${'Token'.padEnd(6)} ${'Txs'.padStart(5)}  ${'Gross Volume'.padStart(14)}`);
  console.log(' ' + L);
  for (const r of rows) {
    const amt = r.dir === 'IN' ? '$'+r.grossUSD.toFixed(2) : r.gross.toFixed(4)+' TAO (~$'+r.grossUSD.toFixed(0)+')';
    console.log(` ${r.dir.padEnd(5)} ${r.chain.padEnd(14)} ${r.token.padEnd(6)} ${String(r.txs).padStart(5)}  ${amt}`);
  }
  console.log(' ' + L);
  console.log(` Bridge IN  total : $${grandGrossIn.toFixed(2)} (${grandTxsIn} txs)`);
  console.log(` Bridge OUT total : ~$${grandGrossOut.toFixed(2)} (${grandTxsOut} txs)`);
  console.log(' ' + L);
  console.log(` GRAND TOTAL : ~$${(grandGrossIn + grandGrossOut).toFixed(2)} | ${grandTxsIn + grandTxsOut} txs`);
  console.log(' ' + L);
})().catch(console.error);

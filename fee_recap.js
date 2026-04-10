require('dotenv').config();
const { ethers } = require('ethers');

const RPCS = {
  1:    process.env.ETH_RPC    || 'https://ethereum.publicnode.com',
  8453: process.env.BASE_RPC   || 'https://mainnet.base.org',
  56:   process.env.BSC_RPC    || 'https://bsc.publicnode.com',
  964:  'https://lite.chain.opentensor.ai',
};

const VAULTS = {
  1:    { addr: '0x6eC196A4330d6F48Fa7f2f908b1F6CCebe9E6Fcb', tokens: [{ sym:'USDC', addr:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', dec:6 }, { sym:'USDT', addr:'0xdAC17F958D2ee523a2206206994597C13D831ec7', dec:6 }] },
  8453: { addr: '0xFB5b153b5c5B86B96A0d33d08B2bDf58D6A9571d', tokens: [{ sym:'USDC', addr:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', dec:6 }] },
  56:   { addr: '0x8AA0b27440bE72faCcCe0A4FA61Cf7B1E8e25cFf', tokens: [{ sym:'USDC', addr:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', dec:18 }] },
};

const TAO_RECEIVERS = [
  '0x560F9e82e941C8dD8D6A8c75e06E4142210d6a84', // old (1%)
  '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577', // new (5%)
];

const VAULT_ABI = [
  'event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
];
const TAO_RECEIVER_ABI = [
  'event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)',
];

const LOOKBACKS = { 1: 50_000, 8453: 200_000, 56: 100_000 };

async function fetchInChunks(contract, filter, fromBlock, toBlock, chunkSize = 2000) {
  const events = [];
  for (let from = fromBlock; from <= toBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, toBlock);
    try {
      const chunk = await contract.queryFilter(filter, from, to);
      events.push(...chunk);
    } catch {}
  }
  return events;
}

(async () => {
  let totalInGross = 0, totalInFees = 0, totalInTxs = 0;
  let totalOutGross = 0, totalOutFees = 0, totalOutTxs = 0;

  // TAO price for bridge-out estimation
  const TAO_PRICE = Number(process.env.TAO_PRICE || 400);

  console.log('Fetching bridge IN events...\n');
  const inRows = [];
  for (const [chainIdStr, { addr, tokens }] of Object.entries(VAULTS)) {
    const chainId = Number(chainIdStr);
    const provider = new ethers.JsonRpcProvider(RPCS[chainId]);
    const vault = new ethers.Contract(addr, VAULT_ABI, provider);
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - (LOOKBACKS[chainId] || 50_000));

    for (const { sym, addr: tokenAddr, dec } of tokens) {
      const filter = vault.filters.Deposit(tokenAddr);
      const events = await fetchInChunks(vault, filter, fromBlock, latest);
      let gross = 0, fees = 0;
      for (const ev of events) {
        const g = parseFloat(ethers.formatUnits(ev.args.grossAmount, dec));
        const n = parseFloat(ethers.formatUnits(ev.args.netAmount, dec));
        gross += g;
        fees  += (g - n);
      }
      if (events.length > 0) {
        const chain = {1:'ETH',8453:'Base',56:'BSC'}[chainId];
        inRows.push({ chain, sym, txs: events.length, gross, fees });
        totalInGross += gross;
        totalInFees  += fees;
        totalInTxs   += events.length;
      }
    }
  }

  console.log('Fetching bridge OUT events...\n');
  const outRows = [];
  const provider964 = new ethers.JsonRpcProvider(RPCS[964]);
  const latest964 = await provider964.getBlockNumber();
  for (const receiverAddr of TAO_RECEIVERS) {
    const receiver = new ethers.Contract(receiverAddr, TAO_RECEIVER_ABI, provider964);
    const fromBlock = Math.max(0, latest964 - 200_000);
    const events = await fetchInChunks(receiver, receiver.filters.TaoDeposit(), fromBlock, latest964);
    if (events.length === 0) continue;
    let gross = 0, fees = 0;
    for (const ev of events) {
      const g = parseFloat(ethers.formatEther(ev.args.grossAmount));
      const n = parseFloat(ethers.formatEther(ev.args.netAmount));
      gross += g;
      fees  += (g - n);
    }
    const label = receiverAddr.slice(0,8)+'... (' + (receiverAddr.startsWith('0x560') ? '1%' : '5%') + ')';
    outRows.push({ label, txs: events.length, grossTAO: gross, feesTAO: fees });
    totalOutGross += gross;
    totalOutFees  += fees;
    totalOutTxs   += events.length;
  }

  // ─── Print ───────────────────────────────────────────────────────────────
  const line = '─'.repeat(62);
  console.log('\n╔' + '═'.repeat(60) + '╗');
  console.log('║' + '   TAO BRIDGE — FEE RECAP'.padEnd(60) + '║');
  console.log('╚' + '═'.repeat(60) + '╝');

  console.log('\n BRIDGE IN (Stable → TAO) — 0% protocol fee');
  console.log(' ' + line);
  console.log(` ${'Chain'.padEnd(8)} ${'Token'.padEnd(6)} ${'Txs'.padStart(5)}  ${'Gross Volume'.padStart(14)}  ${'Fees'.padStart(10)}`);
  console.log(' ' + line);
  for (const r of inRows) {
    console.log(` ${r.chain.padEnd(8)} ${r.sym.padEnd(6)} ${String(r.txs).padStart(5)}  ${'$'+r.gross.toFixed(2)+''.padStart(14)}  ${'$'+r.fees.toFixed(4)}`);
  }
  console.log(' ' + line);
  console.log(` ${'TOTAL'.padEnd(15)} ${String(totalInTxs).padStart(5)}  ${'$'+totalInGross.toFixed(2)+''.padStart(14)}  ${'$'+totalInFees.toFixed(4)}`);

  console.log('\n BRIDGE OUT (TAO → Stable) — fee stored in TaoReceiver');
  console.log(' ' + line);
  console.log(` ${'Receiver'.padEnd(22)} ${'Txs'.padStart(5)}  ${'Gross (TAO)'.padStart(12)}  ${'Fees (TAO)'.padStart(11)}  ${'Fees (USD~)'.padStart(11)}`);
  console.log(' ' + line);
  for (const r of outRows) {
    const feesUSD = r.feesTAO * TAO_PRICE;
    console.log(` ${r.label.padEnd(22)} ${String(r.txs).padStart(5)}  ${r.grossTAO.toFixed(6).padStart(12)}  ${r.feesTAO.toFixed(6).padStart(11)}  ${'$'+feesUSD.toFixed(2)+''.padStart(11)}`);
  }
  console.log(' ' + line);
  const totalFeesUSD = totalOutFees * TAO_PRICE;
  console.log(` ${'TOTAL'.padEnd(22)} ${String(totalOutTxs).padStart(5)}  ${totalOutGross.toFixed(6).padStart(12)}  ${totalOutFees.toFixed(6).padStart(11)}  ${'$'+totalFeesUSD.toFixed(2)+''.padStart(11)}`);

  console.log('\n SUMMARY');
  console.log(' ' + line);
  console.log(` Bridge IN volume  : $${totalInGross.toFixed(2)} (${totalInTxs} txs)`);
  console.log(` Bridge OUT volume : ${totalOutGross.toFixed(4)} TAO (~$${(totalOutGross*TAO_PRICE).toFixed(2)}) (${totalOutTxs} txs)`);
  console.log(` Bridge IN fees    : $${totalInFees.toFixed(4)}`);
  console.log(` Bridge OUT fees   : ${totalOutFees.toFixed(6)} TAO (~$${totalFeesUSD.toFixed(2)})`);
  console.log(` Total fees (USD)  : ~$${(totalInFees + totalFeesUSD).toFixed(2)}`);
  console.log(' ' + line);
})().catch(console.error);

const { ethers } = require('ethers');

const base = new ethers.JsonRpcProvider('https://base.publicnode.com');
const bsc  = new ethers.JsonRpcProvider('https://bsc.publicnode.com');
const eth  = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
const tao  = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');

const CHAINS = [
  { name: 'Base', provider: base, vault: '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063', decimals: 6,  lookback: 100000 },
  { name: 'BSC',  provider: bsc,  vault: '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063', decimals: 18, lookback: 200000 },
  { name: 'ETH',  provider: eth,  vault: '0x6ec196a4330d6f48fa7f2f908b1f6ccebe9e6fcb', decimals: 6,  lookback: 50000  },
];

const VAULT_ABI = ['event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const TAO_RECEIVER_ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const RECEIVERS = ['0x560F9e82e941C8dD8D6A8c75e06E4142210d6a84', '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577'];

async function scanEvents(contract, filter, fromBlock, toBlock, chunkSize = 2000) {
  const events = [];
  for (let b = fromBlock; b <= toBlock; b += chunkSize) {
    const to = Math.min(b + chunkSize - 1, toBlock);
    try { events.push(...await contract.queryFilter(filter, b, to)); } catch {}
  }
  return events;
}

(async () => {
  let totalGross = 0, totalNet = 0, totalTxs = 0;
  console.log('=== BRIDGE IN (EVM → TAO) ===');

  for (const c of CHAINS) {
    const latest = await c.provider.getBlockNumber();
    const from   = Math.max(0, latest - c.lookback);
    const vault  = new ethers.Contract(c.vault, VAULT_ABI, c.provider);
    const events = await scanEvents(vault, vault.filters.Deposit(), from, latest);
    let gross = 0, net = 0;
    for (const ev of events) {
      gross += Number(ev.args.grossAmount) / Math.pow(10, c.decimals);
      net   += Number(ev.args.netAmount)   / Math.pow(10, c.decimals);
    }
    console.log(c.name + ' | ' + events.length + ' txs | gross $' + gross.toFixed(2) + ' | net $' + net.toFixed(2) + ' | fees $' + (gross - net).toFixed(2));
    totalGross += gross; totalNet += net; totalTxs += events.length;
  }

  console.log('─────────────────────────────────────────────────────────');
  console.log('TOTAL | ' + totalTxs + ' txs | gross $' + totalGross.toFixed(2) + ' | net $' + totalNet.toFixed(2) + ' | fees $' + (totalGross - totalNet).toFixed(2));

  // Bridge OUT
  let outCount = 0, outGross = 0, outNet = 0;
  const latestTao = await tao.getBlockNumber();
  for (const addr of RECEIVERS) {
    const receiver = new ethers.Contract(addr, TAO_RECEIVER_ABI, tao);
    const from = Math.max(0, latestTao - 200000);
    const events = await scanEvents(receiver, receiver.filters.TaoDeposit(), from, latestTao, 5000);
    for (const ev of events) {
      outGross += parseFloat(ethers.formatEther(ev.args.grossAmount));
      outNet   += parseFloat(ethers.formatEther(ev.args.netAmount));
      outCount++;
    }
  }
  console.log('\n=== BRIDGE OUT (TAO → EVM) ===');
  console.log('TOTAL | ' + outCount + ' txs | gross ' + outGross.toFixed(4) + ' TAO | net ' + outNet.toFixed(4) + ' TAO | fees ' + (outGross - outNet).toFixed(4) + ' TAO');
})().catch(console.error);

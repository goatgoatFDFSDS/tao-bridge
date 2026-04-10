require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RECEIVER = '0x176F0A5BB9d716dAA8baFf3E0E0AcacAD7785577';
const ABI = ['event TaoDeposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const c = new ethers.Contract(RECEIVER, ABI, provider);

(async () => {
  // Search around block 7916426
  const targetBlock = 7916426;
  for (let from = targetBlock - 50; from <= targetBlock + 50; from += 100) {
    try {
      const events = await c.queryFilter(c.filters.TaoDeposit(), from, from + 99);
      for (const ev of events) {
        console.log('Block:', ev.blockNumber, '| Nonce:', ev.args.nonce.toString(),
          '| dest:', ev.args.destChainId.toString(),
          '| gross:', ethers.formatEther(ev.args.grossAmount),
          '| recipient:', ev.args.recipient);
      }
    } catch(e) { console.log('Error range', from, ':', e.message); }
  }
})().catch(console.error);

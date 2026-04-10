require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC || 'https://bsc.publicnode.com');
const VAULT = '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063';
const ABI = ['event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const USDT_BSC = '0x55d398326f99059ff775485246999027b3197955';
(async () => {
  const vault = new ethers.Contract(VAULT, ABI, provider);
  const current = await provider.getBlockNumber();
  // BSC nonce 12 processed_at=1775536608, current ~1775570000 => ~33000s ago => ~11000 blocks, try ±30000
  const target = current - 11000;
  for (let b = target - 30000; b < target + 10000; b += 5000) {
    try {
      const events = await vault.queryFilter(vault.filters.Deposit(), b, b + 4999);
      for (const ev of events) {
        if (Number(ev.args.nonce) === 12) {
          const dec = ev.args.token.toLowerCase() === USDT_BSC ? 18 : 6;
          console.log('BSC Nonce 12 found!');
          console.log('gross:', ethers.formatUnits(ev.args.grossAmount, dec));
          console.log('net:', ethers.formatUnits(ev.args.netAmount, dec));
          console.log('recipient:', ev.args.recipient);
          console.log('token:', ev.args.token);
          console.log('block:', ev.blockNumber);
          return;
        }
      }
    } catch(e) {}
  }
  console.log('Not found in range');
})().catch(console.error);

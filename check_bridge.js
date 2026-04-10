const { ethers } = require('ethers');
const baseP = new ethers.JsonRpcProvider('https://mainnet.base.org');
const taoP  = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');

const VAULT_ABI = [
  'event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'
];

async function check(hash) {
  const receipt = await baseP.getTransactionReceipt(hash);
  const iface = new ethers.Interface(VAULT_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed) continue;
      const recipient = parsed.args.recipient;
      const net   = ethers.formatUnits(parsed.args.netAmount, 6);
      const gross = ethers.formatUnits(parsed.args.grossAmount, 6);
      console.log('\nTX:', hash.slice(0, 20) + '...');
      console.log('  Sender:   ', parsed.args.sender);
      console.log('  Recipient:', recipient);
      console.log('  Amount:   ', gross, 'USDC gross /', net, 'net');

      const taoBal = await taoP.getBalance(recipient);
      console.log('  TAO balance on Bittensor:', ethers.formatEther(taoBal), 'TAO');

      // Check recent blocks for incoming TAO
      const block = await taoP.getBlockNumber();
      let found = false;
      for (let b = block; b > block - 500 && !found; b -= 5) {
        const blk = await taoP.getBlock(b, true);
        if (!blk || !blk.transactions) continue;
        for (const t of blk.transactions) {
          if (typeof t === 'object' && t.to && t.to.toLowerCase() === recipient.toLowerCase() && t.value > 0n) {
            console.log('  TAO received tx:', t.hash, ethers.formatEther(t.value), 'TAO');
            found = true;
          }
        }
      }
      if (!found) console.log('  No TAO incoming tx found in last 500 blocks');
    } catch(e) {}
  }
}

async function main() {
  await check('0xb914a74bfada43aa984a29370931faaa3414ea88691a21d85a9523eb445d1126');
  await check('0xf8fc59493a1c4ca3f96d85fac32b96200a5a1495901aaa5d8ea731eb27a7798a');
}
main().catch(console.error);

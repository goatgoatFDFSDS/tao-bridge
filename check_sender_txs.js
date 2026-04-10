const { ethers } = require('ethers');
const tao = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');

const SENDER = '0x5c5ac3552e55add6a9054450eacc04d9bce6e754';
const RECEIVERS = [
  '0x560f9e82e941c8dd8d6a8c75e06e4142210d6a84',
  '0x176f0a5bb9d716daa8baff3e0e0acacad7785577',
];

(async () => {
  const latest = await tao.getBlockNumber();
  console.log('Scanning last 500 blocks from', latest);
  for (let b = latest; b >= latest - 500; b -= 10) {
    const block = await tao.getBlock(b, true);
    if (!block || !block.transactions) continue;
    for (const tx of block.transactions) {
      if (tx.from && tx.from.toLowerCase() === SENDER.toLowerCase()) {
        console.log('TX from sender | block=' + tx.blockNumber + ' | to=' + tx.to + ' | value=' + ethers.formatEther(tx.value) + ' TAO | hash=' + tx.hash);
      }
    }
  }
  console.log('Done');
})().catch(console.error);

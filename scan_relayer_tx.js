const { ethers } = require('ethers');
const tao = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RELAYER = '0x72545c58967d31f610C466F7AdFE3E87335E0068'.toLowerCase();
const RECIP   = '0xa242dc9cc272d3d7b3510dffad11ce38e6aae09e'.toLowerCase();

(async () => {
  const latest = await tao.getBlockNumber();
  console.log('Scanning last 500 blocks from', latest);
  for (let b = latest; b >= latest - 500; b -= 5) {
    const block = await tao.getBlock(b, true);
    if (!block || !block.transactions) continue;
    for (const tx of block.transactions) {
      if (tx.from && tx.from.toLowerCase() === RELAYER && tx.to && tx.to.toLowerCase() === RECIP) {
        console.log('FOUND | block=' + tx.blockNumber + ' | ' + ethers.formatEther(tx.value) + ' TAO | tx=' + tx.hash);
      }
    }
  }
  console.log('Done');
})().catch(console.error);

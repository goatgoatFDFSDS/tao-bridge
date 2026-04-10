const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');
const RELAYER = '0x72545c58967d31f610C466F7AdFE3E87335E0068';

const pending = [
  { nonce: '12', recipient: '0xA242dC9Cc272D3d7B3510dfFAd11Ce38e6AAE09E', usd: 297.00 },
  { nonce: '13', recipient: '0xbF81b2728aB3f9c1be98c0288ECC0150bF679Fa2', usd: 4.95 },
  { nonce: '15', recipient: '0x09C781aDCd1b8d125F544625B9841C5FBd45d8a8', usd: 2.93 },
  { nonce: '16', recipient: '0x50a492eC830754e0b85632A5E129c986d7AbFe6a', usd: 5.01 },
  { nonce: '17', recipient: '0x2f2a035092B68B5DE8FCA1a46f968697a90e4D21', usd: 15.10 },
  { nonce: '18', recipient: '0xF774342f909881b06a24398921BFBe023abDea05', usd: 0.00 },
  { nonce: '19', recipient: '0x38F78e62b46FC641A77c4efb23b37F794186D65b', usd: 2.08 },
  { nonce: '21', recipient: '0x5C5Ac3552e55add6a9054450eaCc04d9bCe6e754', usd: 21.94 },
];

(async () => {
  // For each recipient, find incoming TAO from relayer
  for (const d of pending) {
    // Check recent blocks for txs from relayer to recipient
    const latest = await provider.getBlockNumber();
    let found = null;
    // Scan last 500 blocks
    for (let b = latest; b >= latest - 500 && !found; b -= 50) {
      const block = await provider.getBlock(b, true);
      if (!block || !block.transactions) continue;
      for (const tx of block.transactions) {
        if (
          tx.from && tx.from.toLowerCase() === RELAYER.toLowerCase() &&
          tx.to && tx.to.toLowerCase() === d.recipient.toLowerCase()
        ) {
          found = tx;
          break;
        }
      }
    }
    if (found) {
      console.log('Nonce ' + d.nonce + ' | ✅ FOUND | ' + ethers.formatEther(found.value) + ' TAO | tx=' + found.hash);
    } else {
      console.log('Nonce ' + d.nonce + ' | ❌ NOT FOUND in last 500 blocks | recipient=' + d.recipient.slice(0,10) + '...');
    }
  }
})().catch(console.error);

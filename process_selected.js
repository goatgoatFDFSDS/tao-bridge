const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const { usdToTaoWei } = require('./relayer/config');
const db = require('./relayer/db');
const fs = require('fs');

const pk = fs.readFileSync('/Users/pro/tao-bridge/.env', 'utf8').match(/RELAYER_PRIVATE_KEY=(.+)/)[1];
const signer = new ethers.Wallet(pk, new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai'));

const deposits = [
  { nonce: '13', recip: '0xbF81b2728aB3f9c1be98c0288ECC0150bF679Fa2', netUsd: 4.95 },
  { nonce: '15', recip: '0x09C781aDCd1b8d125F544625B9841C5FBd45d8a8', netUsd: 2.93 },
  { nonce: '16', recip: '0x50a492eC830754e0b85632A5E129c986d7AbFe6a', netUsd: 5.01 },
  { nonce: '17', recip: '0x2f2a035092B68B5DE8FCA1a46f968697a90e4D21', netUsd: 15.10 },
  { nonce: '19', recip: '0x38F78e62b46FC641A77c4efb23b37F794186D65b', netUsd: 2.08 },
];

(async () => {
  const taoPrice = await getTaoPrice();
  console.log('TAO price: $' + taoPrice);

  for (const d of deposits) {
    const claimed = db.claimDeposit(8453, d.nonce);
    if (!claimed) {
      console.log('Nonce ' + d.nonce + ' already claimed — skip');
      continue;
    }
    const taoWei = usdToTaoWei(d.netUsd, taoPrice);
    const tx = await signer.sendTransaction({ to: d.recip, value: taoWei });
    await tx.wait();
    db.markDepositProcessed(8453, d.nonce, tx.hash);
    console.log('Nonce ' + d.nonce + ' | $' + d.netUsd + ' | ' + ethers.formatEther(taoWei) + ' TAO → ' + d.recip.slice(0, 10) + '... | ✅ ' + tx.hash);
  }
  console.log('Done!');
})().catch(console.error);

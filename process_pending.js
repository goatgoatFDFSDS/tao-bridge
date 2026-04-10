const { ethers } = require('ethers');
const { getTaoPrice } = require('./relayer/price');
const { usdToTaoWei } = require('./relayer/config');
const db = require('./relayer/db');
const fs = require('fs');

const base = new ethers.JsonRpcProvider('https://mainnet.base.org');
const VAULT = '0xcd3BB66c4baD58c9C0283C70CbCBD7950Aa4c063'.toLowerCase();
const pk = fs.readFileSync('/Users/pro/tao-bridge/.env', 'utf8').match(/RELAYER_PRIVATE_KEY=(.+)/)[1];
const signer = new ethers.Wallet(pk, new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai'));

const txHashes = [
  '0xdf5ebc3076045a86ed399079b7eb815ab537463fdbbcdcfb742837ef4334e7d8',
  '0x79cec13b348a338d941fc86cbd76baf5c0250fabd41bb0f3e2ef490b1ca6b430',
  '0x458aed9599b7770ba5a609c132b92e7d2deb96e5920781106d68558a7fbe20f9',
  '0xc2a43cc3386226ee60c421851efb2bea010b8b07b2d75a8bceda8c952a89b18a',
  '0xa78609d7f9d2c4cdec0ac30f1035c9e51eac4f39cca96f7e6005dc70b08048dd',
  '0xea73ea0213ec782c1d78034fa117d27f42abdcfc1bb5dcd5b6d2c9dbec76fbc9',
];

(async () => {
  const taoPrice = await getTaoPrice();
  console.log('TAO price: $' + taoPrice);

  const deposits = [];
  for (const hash of txHashes) {
    const receipt = await base.getTransactionReceipt(hash);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === VAULT) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256','uint256','uint256'], log.data);
        const recip  = '0x' + log.topics[3].slice(26);
        const nonce  = decoded[2].toString();
        const netUsd = Number(decoded[1]) / 1e6;
        deposits.push({ hash: hash.slice(0, 10), nonce, recip, netUsd });
      }
    }
  }

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
    console.log('Nonce ' + d.nonce + ' | $' + d.netUsd.toFixed(2) + ' | ' + ethers.formatEther(taoWei) + ' TAO → ' + d.recip.slice(0, 10) + '... | OK');
  }
  console.log('All done!');
})().catch(console.error);

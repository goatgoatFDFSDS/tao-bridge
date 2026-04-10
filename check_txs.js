const { ethers } = require('ethers');
const Database = require('./node_modules/better-sqlite3');
const db = new Database('./relayer.db');

const eth  = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
const bsc  = new ethers.JsonRpcProvider('https://bsc.publicnode.com');
const tao  = new ethers.JsonRpcProvider('https://lite.chain.opentensor.ai');

const ETH_VAULT = '0x6ec196a4330d6f48fa7f2f908b1f6ccebe9e6fcb';
const BSC_VAULT = '0xcd3bb66c4bad58c9c0283c70cbcbd7950aa4c063';

const txs = [
  { hash: '0xbeb28ce68a8011f8701d2f0a18140a31c3bd165376a6cde1d6a997343b9d356d', provider: eth, chainId: 1,  chain: 'ETH', vault: ETH_VAULT, decimals: 6 },
  { hash: '0x8034995563bab0e98e35e0460921b952c0a8a7f268aafca4b7d8462dfa50bc2b', provider: bsc, chainId: 56, chain: 'BSC', vault: BSC_VAULT, decimals: 18 },
  { hash: '0xa67a1e2a204deaf4dc8da60cef043ee3680bd5b2a14f989eb70b3f7dadb85aec', provider: bsc, chainId: 56, chain: 'BSC', vault: BSC_VAULT, decimals: 18 },
];

(async () => {
  for (const t of txs) {
    const receipt = await t.provider.getTransactionReceipt(t.hash);
    let nonce, recip, netUsd;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === t.vault) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256','uint256','uint256'], log.data);
        nonce  = decoded[2].toString();
        recip  = '0x' + log.topics[3].slice(26);
        netUsd = (Number(decoded[1]) / Math.pow(10, t.decimals)).toFixed(2);
      }
    }

    console.log('[' + t.chain + '] Nonce=' + nonce + ' | $' + netUsd + ' | Recipient: ' + recip);

    const row = db.prepare('SELECT * FROM processed_deposits WHERE src_chain_id = ? AND src_nonce = ?').get(t.chainId, nonce);
    console.log('  DB: ' + (row ? row.status + ' | tx=' + (row.tx_hash || 'none') : 'NOT IN DB'));

    const bal = await tao.getBalance(recip);
    console.log('  TAO balance: ' + ethers.formatEther(bal) + ' TAO');

    if (row && row.tx_hash) {
      const tx = await tao.getTransaction(row.tx_hash);
      if (tx) console.log('  TAO sent: ' + ethers.formatEther(tx.value) + ' TAO ✅');
      else console.log('  TAO tx not found on chain ❌');
    }
    console.log('');
  }
})().catch(console.error);

const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const db = new Database('/Users/pro/brain-bot/brain.db');

const provider = new ethers.JsonRpcProvider('https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6');
const TFLOW = '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91';
const tflow = new ethers.Contract(TFLOW, ['function balanceOf(address) view returns (uint256)'], provider);

const wallets = db.prepare('SELECT w.user_id, w.slot, w.address FROM wallets w').all();

(async () => {
  const results = await Promise.all(wallets.map(async w => {
    try {
      const [tao, tf] = await Promise.all([provider.getBalance(w.address), tflow.balanceOf(w.address)]);
      return { ...w, tao: parseFloat(ethers.formatEther(tao)), tf: parseFloat(ethers.formatEther(tf)) };
    } catch { return { ...w, tao: 0, tf: 0 }; }
  }));

  // Group by user
  const byUser = {};
  for (const r of results) {
    if (!byUser[r.user_id]) byUser[r.user_id] = { tao: 0, tf: 0 };
    byUser[r.user_id].tao += r.tao;
    byUser[r.user_id].tf  += r.tf;
  }

  const fundedUsers = Object.entries(byUser).filter(([,v]) => v.tao > 0.001 || v.tf > 0);

  console.log('Total wallets:', results.length, '| Users:', Object.keys(byUser).length);
  console.log('Funded users:', fundedUsers.length);
  console.log('');

  fundedUsers.sort((a,b) => b[1].tao - a[1].tao).forEach(([uid, v]) => {
    console.log('user_id:', uid, '| TAO:', v.tao.toFixed(4), '| TFLOW:', v.tf.toFixed(2));
  });

  const totalTao = results.reduce((s,r) => s + r.tao, 0);
  const totalTf  = results.reduce((s,r) => s + r.tf, 0);
  console.log('');
  console.log('─'.repeat(50));
  console.log('TOTAL TAO   :', totalTao.toFixed(4));
  console.log('TOTAL TFLOW :', totalTf.toFixed(2));
})().catch(console.error);

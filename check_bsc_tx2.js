require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC || 'https://bsc.publicnode.com');
const HASH = '0x986def1b9746071abcbcf86959963eee36d98c8e20a94b651cd14ab6b30f5bd5';
(async () => {
  const [tx, rc] = await Promise.all([provider.getTransaction(HASH), provider.getTransactionReceipt(HASH)]);
  console.log('To:', tx.to);
  console.log('From:', tx.from);
  console.log('Value:', ethers.formatEther(tx.value));
  console.log('Data:', tx.data.slice(0, 10), '...');
  console.log('Logs count:', rc.logs.length);
  rc.logs.forEach((l, i) => {
    console.log('Log', i, '| address:', l.address, '| topics:', l.topics);
    console.log('  data:', l.data.slice(0, 66));
  });
})().catch(console.error);

require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./node_modules/better-sqlite3')('./relayer.db');
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC || 'https://bsc.publicnode.com');
const HASH = '0x986def1b9746071abcbcf86959963eee36d98c8e20a94b651cd14ab6b30f5bd5';
const ABI = ['event Deposit(address indexed token, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const iface = new ethers.Interface(ABI);
(async () => {
  const rc = await provider.getTransactionReceipt(HASH);
  for (const log of rc.logs) {
    try {
      const p = iface.parseLog(log);
      if (p) {
        console.log('token:', p.args.token);
        console.log('sender:', p.args.sender);
        console.log('recipient:', p.args.recipient);
        console.log('grossAmount:', ethers.formatUnits(p.args.grossAmount, 18));
        console.log('netAmount:', ethers.formatUnits(p.args.netAmount, 18));
        console.log('nonce:', p.args.nonce.toString());
        const row = db.prepare('SELECT * FROM processed_deposits WHERE src_chain_id=56 AND src_nonce=?').get(p.args.nonce.toString());
        console.log('DB:', row ? JSON.stringify(row) : 'NOT IN DB');
      }
    } catch(e) {}
  }
})().catch(console.error);

require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC || 'https://bsc.publicnode.com');
const HASH = '0x986def1b9746071abcbcf86959963eee36d98c8e20a94b651cd14ab6b30f5bd5';
const ABI = ['event Deposit(address indexed sender, address indexed recipient, uint256 destChainId, address destToken, uint256 grossAmount, uint256 netAmount, uint256 nonce)'];
const iface = new ethers.Interface(ABI);
(async () => {
  const [tx, rc] = await Promise.all([provider.getTransaction(HASH), provider.getTransactionReceipt(HASH)]);
  if (!tx || !rc) { console.log('TX not found'); return; }
  console.log('Status:', rc.status, '| Block:', tx.blockNumber);
  for (const log of rc.logs) {
    try {
      const p = iface.parseLog(log);
      if (p) {
        console.log('recipient:', p.args.recipient);
        console.log('destChainId:', p.args.destChainId.toString());
        console.log('destToken:', p.args.destToken);
        console.log('grossAmount:', ethers.formatUnits(p.args.grossAmount, 18));
        console.log('netAmount:', ethers.formatUnits(p.args.netAmount, 18));
        console.log('nonce:', p.args.nonce.toString());
      }
    } catch(e) {}
  }
})().catch(console.error);

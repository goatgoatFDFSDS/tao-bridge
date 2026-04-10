require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org');
(async () => {
  const r = await provider.getTransactionReceipt('0xbac8927cfcfe0be98c8156a07cacc7d1068c45aed928ec38ed0a0464068dc684');
  if (!r) { console.log('TX not found'); return; }
  console.log('Status:', r.status === 1 ? 'SUCCESS' : 'FAILED');
  console.log('To:', r.to);
  const iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
  for (const log of r.logs) {
    try {
      const parsed = iface.parseLog(log);
      console.log('Transfer to:', parsed.args.to, '| amount:', ethers.formatUnits(parsed.args.value, 6), 'USDC');
    } catch {}
  }
})().catch(console.error);

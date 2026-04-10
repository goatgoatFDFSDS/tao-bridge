require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org');
(async () => {
  const r = await provider.getTransactionReceipt('0xcc233f0f69994943197cfaa1018dae302e06adf2f60e7b1cd0184ea18bebb6f4');
  if (!r) { console.log('TX not found on Base'); return; }
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

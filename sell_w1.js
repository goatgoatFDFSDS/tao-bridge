const { ethers } = require('ethers');

const data = require('/Users/pro/brain-bot/wallets_backup.json');
const W1 = data.wallets.find(w => w.slot === 1);
const TFLOW = '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91';
const RPC = 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6';

const TOKEN_ABI = [
  'function sell(uint256 tokenAmount, uint256 minTaoOut, uint256 deadline) external',
  'function getTaoOut(uint256 tokenAmount) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const provider = new ethers.JsonRpcProvider(RPC);

(async () => {
  const signer = new ethers.Wallet(W1.pk, provider);
  const token  = new ethers.Contract(TFLOW, TOKEN_ABI, signer);
  const bal    = await token.balanceOf(signer.address);
  if (bal === 0n) { console.log('W1: no TFLOW'); return; }
  const taoOut = await token.getTaoOut(bal);
  const minOut = taoOut * 95n / 100n;
  const deadline = BigInt(Math.floor(Date.now()/1000) + 300);
  console.log(`W1: selling ${ethers.formatEther(bal)} TFLOW (~${ethers.formatEther(taoOut)} TAO)...`);
  const tx = await token.sell(bal, minOut, deadline, { gasLimit: 300000 });
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('✅ Done');
})().catch(console.error);

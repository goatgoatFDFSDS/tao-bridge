const { ethers } = require('ethers');
const data = require('/Users/pro/brain-bot/wallets_backup.json');

const provider = new ethers.JsonRpcProvider('https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6');
const TFLOW = '0x743fD5E76714394C1DB6790E83b9B50cdeC03A91';
const ERC20 = ['function balanceOf(address) view returns (uint256)'];
const tflow = new ethers.Contract(TFLOW, ERC20, provider);

(async () => {
  const wallets = data.wallets;
  let totalTao = 0n, totalTflow = 0n;

  for (let i = 0; i < wallets.length; i++) {
    const addr = wallets[i].address;
    const [tao, tf] = await Promise.all([
      provider.getBalance(addr),
      tflow.balanceOf(addr)
    ]);
    const taoF = parseFloat(ethers.formatEther(tao));
    const tfF = parseFloat(ethers.formatEther(tf));
    totalTao += tao;
    totalTflow += tf;
    console.log(`W${i+1} | ${addr} | ${taoF.toFixed(4)} TAO | ${tfF.toFixed(0)} TFLOW`);
  }

  console.log('─'.repeat(70));
  console.log(`TOTAL | ${parseFloat(ethers.formatEther(totalTao)).toFixed(4)} TAO | ${parseFloat(ethers.formatEther(totalTflow)).toFixed(0)} TFLOW`);
})().catch(console.error);

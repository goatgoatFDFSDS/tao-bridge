require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ethers } = require('ethers');

const TO     = '0x480867782D58b5fB815d9C3EdC0562F8DaAE6805';
const USDC   = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const amount = 11_410_900n; // 11.4109 USDC (6 dec)

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC);
  const signer   = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  const usdc     = new ethers.Contract(USDC, ['function transfer(address to, uint256 amount) returns (bool)'], signer);
  console.log(`Sending 11.4109 USDC → ${TO}…`);
  const tx = await usdc.transfer(TO, amount);
  console.log('tx:', tx.hash);
  await tx.wait();
  console.log('✓ Done');
})();

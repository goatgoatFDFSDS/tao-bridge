/**
 * Deploy TaoReceiver on Bittensor EVM mainnet (chain 964)
 * Usage: npx hardhat run deploy/02_deploy_tao_receiver.js --network bittensor
 */
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const relayerAddress = process.env.RELAYER_ADDRESS;

  if (!relayerAddress) throw new Error('Set RELAYER_ADDRESS in .env');

  console.log('Deploying TaoReceiver on Bittensor EVM mainnet (chain 964)');
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Relayer  : ${relayerAddress}`);

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance  : ${ethers.formatEther(bal)} TAO`);

  const TaoReceiver = await ethers.getContractFactory('TaoReceiver');
  const receiver    = await TaoReceiver.deploy(relayerAddress);
  await receiver.waitForDeployment();

  const addr = await receiver.getAddress();
  console.log(`\nTaoReceiver deployed: ${addr}`);
  console.log('\nAdd to .env and frontend/.env:');
  console.log(`BITTENSOR_TAO_RECEIVER_ADDRESS=${addr}`);
  console.log(`VITE_TAO_RECEIVER_ADDRESS=${addr}`);
}

main().catch(err => { console.error(err); process.exit(1); });

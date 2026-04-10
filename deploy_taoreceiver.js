require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/TaoReceiver.sol/TaoReceiver.json', 'utf8'));
const provider = new ethers.JsonRpcProvider(process.env.BITTENSOR_RPC || 'https://lite.chain.opentensor.ai');
const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

(async () => {
  const relayer = process.env.RELAYER_ADDRESS;
  console.log('Deployer:', deployer.address);
  console.log('Relayer:', relayer);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(deployer.address)), 'TAO');

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  console.log('Deploying TaoReceiver (5% fee)...');
  const contract = await factory.deploy(relayer);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log('TaoReceiver deployed at:', addr);
  console.log('Update BITTENSOR_TAO_RECEIVER_ADDRESS=' + addr + ' in .env');
})().catch(console.error);

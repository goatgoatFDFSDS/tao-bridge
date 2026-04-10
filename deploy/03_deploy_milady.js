/**
 * Deploy TaoMilady NFT on Bittensor EVM (chain 964)
 * Usage: npx hardhat run deploy/03_deploy_milady.js --network bittensor
 *
 * Set BASE_URI before running — format: ipfs://<CID>/
 * (leave empty to set later with setBaseURI)
 */
const { ethers } = require('hardhat');

const BASE_URI = process.env.MILADY_BASE_URI || '';

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log('Deploying TaoMilady on Bittensor EVM');
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} TAO`);
  console.log(`Base URI : ${BASE_URI || '(empty — set later)'}`);
  console.log('');

  const Factory  = await ethers.getContractFactory('TaoMilady');
  const contract = await Factory.deploy(BASE_URI);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✓ TaoMilady deployed: ${address}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Upload 1111 PNGs + JSONs to IPFS and get the CID`);
  console.log(`  2. If BASE_URI was empty: call setBaseURI("ipfs://<CID>/")`);
  console.log(`  3. Open mint: call setMintOpen(true)`);
  console.log(`  4. Add VITE_MILADY_CONTRACT=${address} to frontend/.env`);
}

main().catch(e => { console.error(e); process.exit(1); });

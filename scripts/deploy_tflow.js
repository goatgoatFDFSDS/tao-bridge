const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Balance:', hre.ethers.formatEther(bal), 'TAO');

  console.log('\nDeploying TFLOWToken...');
  const Token = await hre.ethers.getContractFactory('TFLOWToken');
  const token = await Token.deploy();
  await token.waitForDeployment();

  const addr = await token.getAddress();
  console.log('\n✅ TFLOW deployed:', addr);
  console.log('Supply: 1,000,000,000 TFLOW minted to', deployer.address);
}

main().catch(e => { console.error(e); process.exit(1); });

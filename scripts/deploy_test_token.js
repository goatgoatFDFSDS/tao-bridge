const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Balance:', hre.ethers.formatEther(bal), 'TAO');

  console.log('\nDeploying TestToken...');
  const Token = await hre.ethers.getContractFactory('TestToken');
  const token = await Token.deploy();
  await token.waitForDeployment();

  const addr = await token.getAddress();
  console.log('\n✅ TestToken deployed:', addr);
  console.log('Supply: 1,000,000 TEST minted to', deployer.address);
  console.log('\nAdd to Pools.jsx KNOWN_TOKENS:');
  console.log(`  { symbol: 'TEST', address: '${addr}', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', decimals: 18 }`);
}

main().catch(e => { console.error(e); process.exit(1); });

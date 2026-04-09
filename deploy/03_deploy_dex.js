/**
 * Deploy DEX contracts on Bittensor EVM (chain 964)
 * Usage: npx hardhat run deploy/03_deploy_dex.js --network bittensor
 *
 * Deploys in order:
 *   1. WTAO        — Wrapped TAO (WETH equivalent)
 *   2. UniswapV2Factory — AMM factory with CREATE2 pairs
 *   3. UniswapV2Router02 — Router with swap/liquidity helpers
 *   4. NFTMarketplace   — Simple TAO-native NFT marketplace
 *
 * Saves results to deploy/deployed_dex.json
 */
const { ethers, network } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('\n=== TAOflow DEX Deployment ===');
  console.log('Network  :', network.name);
  console.log('Deployer :', deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance  :', ethers.formatEther(balance), 'TAO\n');

  // ── 1. WTAO ────────────────────────────────────────────────────────────────
  console.log('1/4 Deploying WTAO...');
  const WTAOFactory = await ethers.getContractFactory('WTAO');
  const wtao = await WTAOFactory.deploy();
  await wtao.waitForDeployment();
  const wtaoAddress = await wtao.getAddress();
  console.log('    WTAO deployed at:', wtaoAddress);

  // ── 2. UniswapV2Factory ────────────────────────────────────────────────────
  console.log('2/4 Deploying UniswapV2Factory...');
  const FactoryF = await ethers.getContractFactory('UniswapV2Factory');
  const factory = await FactoryF.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log('    Factory deployed at:', factoryAddress);

  // ── 3. UniswapV2Router02 ──────────────────────────────────────────────────
  console.log('3/4 Deploying UniswapV2Router02...');
  const RouterF = await ethers.getContractFactory('UniswapV2Router02');
  const router = await RouterF.deploy(factoryAddress, wtaoAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log('    Router deployed at:', routerAddress);

  // ── 4. NFTMarketplace ──────────────────────────────────────────────────────
  console.log('4/4 Deploying NFTMarketplace...');
  const MarketF = await ethers.getContractFactory('NFTMarketplace');
  const market = await MarketF.deploy();
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log('    NFTMarketplace deployed at:', marketAddress);

  // ── Save to JSON ───────────────────────────────────────────────────────────
  const deployed = {
    network: network.name,
    chainId: 964,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      WTAO: wtaoAddress,
      UniswapV2Factory: factoryAddress,
      UniswapV2Router02: routerAddress,
      NFTMarketplace: marketAddress,
    },
  };

  const outPath = path.join(__dirname, 'deployed_dex.json');
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log('\n✓ Addresses saved to deploy/deployed_dex.json');

  console.log('\n=== Deployment Summary ===');
  console.log('WTAO              :', wtaoAddress);
  console.log('UniswapV2Factory  :', factoryAddress);
  console.log('UniswapV2Router02 :', routerAddress);
  console.log('NFTMarketplace    :', marketAddress);
  console.log('==========================\n');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

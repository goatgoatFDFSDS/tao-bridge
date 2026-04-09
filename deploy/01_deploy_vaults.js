/**
 * Deploy BridgeVault on ETH, Base, and BSC
 * Usage: npx hardhat run deploy/01_deploy_vaults.js --network ethereum
 *        npx hardhat run deploy/01_deploy_vaults.js --network base
 *        npx hardhat run deploy/01_deploy_vaults.js --network bsc
 */
const { ethers, network } = require('hardhat');

// Token addresses per network
const TOKENS = {
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  base: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  },
  bsc: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  const relayerAddress = process.env.RELAYER_ADDRESS;

  if (!relayerAddress) throw new Error('Set RELAYER_ADDRESS in .env');

  console.log(`Deploying BridgeVault on ${net}`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Relayer:   ${relayerAddress}`);

  const BridgeVault = await ethers.getContractFactory('BridgeVault');
  const vault = await BridgeVault.deploy(relayerAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log(`BridgeVault deployed: ${vaultAddress}`);

  // Whitelist tokens
  const tokens = TOKENS[net];
  if (!tokens) throw new Error(`No token config for network: ${net}`);

  // Wait a bit for nonce to settle then whitelist tokens
  await new Promise(r => setTimeout(r, 4000));
  for (const [symbol, addr] of Object.entries(tokens)) {
    let retries = 3;
    while (retries--) {
      try {
        const tx = await vault.setToken(addr, true);
        await tx.wait();
        console.log(`Whitelisted ${symbol} (${addr})`);
        break;
      } catch (e) {
        if (retries === 0) throw e;
        console.log(`Retry setToken ${symbol}...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.log('\n✓ Done. Add to .env:');
  console.log(`${net.toUpperCase()}_VAULT_ADDRESS=${vaultAddress}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

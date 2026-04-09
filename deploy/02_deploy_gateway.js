/**
 * Deploy BridgeGateway + wUSDC + wUSDT on Bittensor EVM
 * Usage: npx hardhat run deploy/02_deploy_gateway.js --network bittensor
 */
const { ethers } = require('hardhat');

// Source chain token addresses for registration
const TOKEN_REGISTRATIONS = [
  // Ethereum (chainId 1)
  { srcChainId: 1,    srcToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'wUSDC' }, // ETH USDC
  { srcChainId: 1,    srcToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'wUSDT' }, // ETH USDT
  // Base (chainId 8453)
  { srcChainId: 8453, srcToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'wUSDC' }, // Base USDC
  { srcChainId: 8453, srcToken: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', symbol: 'wUSDT' }, // Base USDT
  // BSC (chainId 56)
  { srcChainId: 56,   srcToken: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'wUSDC' }, // BSC USDC
  { srcChainId: 56,   srcToken: '0x55d398326f99059fF775485246999027B3197955', symbol: 'wUSDT' }, // BSC USDT
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const relayerAddress = process.env.RELAYER_ADDRESS;

  if (!relayerAddress) throw new Error('Set RELAYER_ADDRESS in .env');

  console.log('Deploying on Bittensor EVM');
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Relayer:  ${relayerAddress}`);

  // Deploy BridgeGateway first (we need its address for wrapped tokens)
  const BridgeGateway = await ethers.getContractFactory('BridgeGateway');
  const gateway = await BridgeGateway.deploy(relayerAddress);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log(`BridgeGateway deployed: ${gatewayAddress}`);

  // Deploy wUSDC
  const WrappedToken = await ethers.getContractFactory('WrappedToken');
  const wUSDC = await WrappedToken.deploy('Wrapped USDC (TAO Bridge)', 'wUSDC', 6, gatewayAddress);
  await wUSDC.waitForDeployment();
  const wUSDCAddress = await wUSDC.getAddress();
  console.log(`wUSDC deployed: ${wUSDCAddress}`);

  // Deploy wUSDT
  const wUSDT = await WrappedToken.deploy('Wrapped USDT (TAO Bridge)', 'wUSDT', 6, gatewayAddress);
  await wUSDT.waitForDeployment();
  const wUSDTAddress = await wUSDT.getAddress();
  console.log(`wUSDT deployed: ${wUSDTAddress}`);

  // Register all source chain tokens on the gateway
  console.log('\nRegistering token mappings...');
  for (const reg of TOKEN_REGISTRATIONS) {
    const wrappedAddr = reg.symbol === 'wUSDC' ? wUSDCAddress : wUSDTAddress;
    const tx = await gateway.registerToken(reg.srcChainId, reg.srcToken, wrappedAddr);
    await tx.wait();
    console.log(`  Registered chainId:${reg.srcChainId} ${reg.srcToken} → ${reg.symbol}`);
  }

  console.log('\n✓ Done. Add to .env:');
  console.log(`BITTENSOR_GATEWAY_ADDRESS=${gatewayAddress}`);
  console.log(`BITTENSOR_WUSDC_ADDRESS=${wUSDCAddress}`);
  console.log(`BITTENSOR_WUSDT_ADDRESS=${wUSDTAddress}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

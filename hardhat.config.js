require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0x' + '0'.repeat(64);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    ethereum: {
      url: process.env.ETH_RPC || 'https://1rpc.io/eth',
      accounts: [PRIVATE_KEY],
      chainId: 1,
    },
    base: {
      url: process.env.BASE_RPC || 'https://mainnet.base.org',
      accounts: [PRIVATE_KEY],
      chainId: 8453,
    },
    bsc: {
      url: process.env.BSC_RPC || 'https://bsc-dataseed.binance.org',
      accounts: [PRIVATE_KEY],
      chainId: 56,
    },
    bittensor: {
      url: process.env.BITTENSOR_RPC || 'https://api-bittensor-mainnet.n.dwellir.com/514a23e2-83e4-4212-8388-1979709224b6',
      accounts: [PRIVATE_KEY],
      chainId: 964,
      timeout: 120000,
    },
    // Testnets
    sepolia: {
      url: process.env.SEPOLIA_RPC || '',
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
    'base-sepolia': {
      url: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
      accounts: [PRIVATE_KEY],
      chainId: 84532,
    },
    'bittensor-testnet': {
      url: 'https://test.chain.opentensor.ai',
      accounts: [PRIVATE_KEY],
      chainId: 945,
    },
  },
  etherscan: {
    apiKey: {
      mainnet:  process.env.ETHERSCAN_API_KEY || '',
      base:     process.env.BASESCAN_API_KEY  || '',
      bsc:      process.env.BSCSCAN_API_KEY   || '',
    },
    customChains: [
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL:  'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
};

/**
 * Gestion de la liquidité des contrats TAOflow
 * Usage:
 *   node scripts/manage.js tao-balance
 *   node scripts/manage.js tao-add 1.5
 *   node scripts/manage.js tao-remove 1.5
 *   node scripts/manage.js tao-fees
 *
 *   node scripts/manage.js vault-balance base usdc
 *   node scripts/manage.js vault-add base usdc 100
 *   node scripts/manage.js vault-remove base usdc 100
 *   node scripts/manage.js vault-fees base usdc
 */

require('dotenv').config();
const { ethers } = require('ethers');

// ── Config ────────────────────────────────────────────────────────────────────
const BITTENSOR_RPC = process.env.BITTENSOR_RPC || 'https://lite.chain.opentensor.ai';
const TAO_RECEIVER  = process.env.BITTENSOR_TAO_RECEIVER_ADDRESS;

const VAULTS = {
  eth:  { rpc: process.env.ETH_RPC  || 'https://eth.drpc.org',              address: process.env.ETH_VAULT_ADDRESS },
  base: { rpc: process.env.BASE_RPC || 'https://mainnet.base.org',           address: process.env.BASE_VAULT_ADDRESS },
  bsc:  { rpc: process.env.BSC_RPC  || 'https://bsc.publicnode.com',         address: process.env.BSC_VAULT_ADDRESS },
};

const TOKENS = {
  eth: {
    usdc: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6  },
    usdt: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6  },
  },
  base: {
    usdc: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6  },
    usdt: { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6  },
  },
  bsc: {
    usdt: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    usdc: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  },
};

const TAO_RECEIVER_ABI = [
  'function addLiquidity() external payable',
  'function removeLiquidity(uint256 amount) external',
  'function claimFees() external',
  'function getTaoBalance() view returns (uint256)',
  'function accruedFees() view returns (uint256)',
  'function owner() view returns (address)',
];

const VAULT_ABI = [
  'function addLiquidity(address token, uint256 amount) external',
  'function removeLiquidity(address token, uint256 amount) external',
  'function claimFees(address token) external',
  'function getBalance(address token) view returns (uint256)',
  'function accruedFees(address token) view returns (uint256)',
  'function owner() view returns (address)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSigner(rpc) {
  const provider = new ethers.JsonRpcProvider(rpc);
  return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
}

const [,, cmd, arg1, arg2, arg3] = process.argv;

async function main() {
  if (!cmd) { printHelp(); return; }

  // ── TAO commands ──────────────────────────────────────────────────────────
  if (cmd === 'tao-balance') {
    const signer   = getSigner(BITTENSOR_RPC);
    const receiver = new ethers.Contract(TAO_RECEIVER, TAO_RECEIVER_ABI, signer);
    const bal      = await receiver.getTaoBalance();
    const fees     = await receiver.accruedFees();
    console.log('TaoReceiver balance :', ethers.formatEther(bal), 'TAO');
    console.log('Accrued fees        :', ethers.formatEther(fees), 'TAO');
    console.log('Your wallet TAO     :', ethers.formatEther(await signer.provider.getBalance(signer.address)));
    return;
  }

  if (cmd === 'tao-add') {
    const amount   = ethers.parseEther(arg1);
    const signer   = getSigner(BITTENSOR_RPC);
    const receiver = new ethers.Contract(TAO_RECEIVER, TAO_RECEIVER_ABI, signer);
    console.log(`Adding ${arg1} TAO to TaoReceiver...`);
    const tx = await receiver.addLiquidity({ value: amount });
    await tx.wait();
    console.log('✓ Done. TX:', tx.hash);
    return;
  }

  if (cmd === 'tao-remove') {
    const amount   = ethers.parseEther(arg1);
    const signer   = getSigner(BITTENSOR_RPC);
    const receiver = new ethers.Contract(TAO_RECEIVER, TAO_RECEIVER_ABI, signer);
    console.log(`Withdrawing ${arg1} TAO from TaoReceiver...`);
    const tx = await receiver.removeLiquidity(amount);
    await tx.wait();
    console.log('✓ Done. TX:', tx.hash);
    return;
  }

  if (cmd === 'tao-fees') {
    const signer   = getSigner(BITTENSOR_RPC);
    const receiver = new ethers.Contract(TAO_RECEIVER, TAO_RECEIVER_ABI, signer);
    const fees     = await receiver.accruedFees();
    if (fees === 0n) { console.log('No fees to claim.'); return; }
    console.log(`Claiming ${ethers.formatEther(fees)} TAO in fees...`);
    const tx = await receiver.claimFees();
    await tx.wait();
    console.log('✓ Done. TX:', tx.hash);
    return;
  }

  // ── Vault commands ────────────────────────────────────────────────────────
  if (cmd === 'vault-balance') {
    const chain    = arg1?.toLowerCase();
    const symbol   = arg2?.toLowerCase();
    const vaultCfg = VAULTS[chain];
    const tokenCfg = TOKENS[chain]?.[symbol];
    if (!vaultCfg || !tokenCfg) { console.error('Unknown chain/token. Use: eth/base/bsc + usdc/usdt'); return; }

    const signer = getSigner(vaultCfg.rpc);
    const vault  = new ethers.Contract(vaultCfg.address, VAULT_ABI, signer);
    const bal    = await vault.getBalance(tokenCfg.address);
    const fees   = await vault.accruedFees(tokenCfg.address);
    console.log(`Vault ${chain.toUpperCase()} ${symbol.toUpperCase()} balance :`, ethers.formatUnits(bal,  tokenCfg.decimals));
    console.log(`Accrued fees                    :`, ethers.formatUnits(fees, tokenCfg.decimals));
    return;
  }

  if (cmd === 'vault-add') {
    const chain    = arg1?.toLowerCase();
    const symbol   = arg2?.toLowerCase();
    const vaultCfg = VAULTS[chain];
    const tokenCfg = TOKENS[chain]?.[symbol];
    if (!vaultCfg || !tokenCfg || !arg3) { console.error('Usage: vault-add <chain> <token> <amount>'); return; }

    const amount = ethers.parseUnits(arg3, tokenCfg.decimals);
    const signer = getSigner(vaultCfg.rpc);
    const token  = new ethers.Contract(tokenCfg.address, ERC20_ABI, signer);
    const vault  = new ethers.Contract(vaultCfg.address, VAULT_ABI, signer);

    console.log(`Approving ${arg3} ${symbol.toUpperCase()} on ${chain.toUpperCase()}...`);
    const approveTx = await token.approve(vaultCfg.address, amount);
    await approveTx.wait();

    console.log(`Adding liquidity...`);
    const tx = await vault.addLiquidity(tokenCfg.address, amount);
    await tx.wait();
    console.log('✓ Done. TX:', tx.hash);
    return;
  }

  if (cmd === 'vault-remove') {
    const chain    = arg1?.toLowerCase();
    const symbol   = arg2?.toLowerCase();
    const vaultCfg = VAULTS[chain];
    const tokenCfg = TOKENS[chain]?.[symbol];
    if (!vaultCfg || !tokenCfg || !arg3) { console.error('Usage: vault-remove <chain> <token> <amount>'); return; }

    const amount = ethers.parseUnits(arg3, tokenCfg.decimals);
    const signer = getSigner(vaultCfg.rpc);
    const vault  = new ethers.Contract(vaultCfg.address, VAULT_ABI, signer);
    console.log(`Withdrawing ${arg3} ${symbol.toUpperCase()} from ${chain.toUpperCase()} vault...`);
    const tx = await vault.removeLiquidity(tokenCfg.address, amount);
    await tx.wait();
    console.log('✓ Done. TX:', tx.hash);
    return;
  }

  if (cmd === 'vault-fees') {
    const chain    = arg1?.toLowerCase();
    const symbol   = arg2?.toLowerCase();
    const vaultCfg = VAULTS[chain];
    const tokenCfg = TOKENS[chain]?.[symbol];
    if (!vaultCfg || !tokenCfg) { console.error('Usage: vault-fees <chain> <token>'); return; }

    const signer = getSigner(vaultCfg.rpc);
    const vault  = new ethers.Contract(vaultCfg.address, VAULT_ABI, signer);
    const fees   = await vault.accruedFees(tokenCfg.address);
    if (fees === 0n) { console.log('No fees to claim.'); return; }
    console.log(`Claiming ${ethers.formatUnits(fees, tokenCfg.decimals)} ${symbol.toUpperCase()} in fees...`);
    const tx = await vault.claimFees(tokenCfg.address);
    await tx.wait();
    console.log('✓ Done. TX:', tx.hash);
    return;
  }

  printHelp();
}

function printHelp() {
  console.log(`
TAOflow — Liquidity Manager

TaoReceiver (Bittensor EVM):
  node scripts/manage.js tao-balance              Voir le solde + fees
  node scripts/manage.js tao-add <amount>         Déposer du TAO
  node scripts/manage.js tao-remove <amount>      Retirer du TAO
  node scripts/manage.js tao-fees                 Récupérer les fees

Vaults (ETH / Base / BSC):
  node scripts/manage.js vault-balance <chain> <token>
  node scripts/manage.js vault-add     <chain> <token> <amount>
  node scripts/manage.js vault-remove  <chain> <token> <amount>
  node scripts/manage.js vault-fees    <chain> <token>

Exemples:
  node scripts/manage.js tao-balance
  node scripts/manage.js tao-remove 0.5
  node scripts/manage.js vault-balance base usdc
  node scripts/manage.js vault-add base usdc 500
  node scripts/manage.js vault-remove eth usdt 100
  node scripts/manage.js vault-fees bsc usdt
`);
}

main().catch(console.error);

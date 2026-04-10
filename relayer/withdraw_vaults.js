/**
 * Withdraw liquidity from Base and BSC vaults to dev wallet
 * Base:  349 USDC + 66 USDT
 * BSC:   71 USDT + 34 USDC
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ethers } = require('ethers');

const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const DEV_WALLET  = '0x72545c58967d31f610C466F7AdFE3E87335E0068';

const VAULT_ABI = [
  'function removeLiquidity(address token, uint256 amount) external',
  'function balanceOf(address token) external view returns (uint256)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const BASE = {
  rpc:   process.env.BASE_RPC,
  vault: process.env.BASE_VAULT_ADDRESS,
  tokens: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6,  amount: 349n * 10n**6n  },
    USDT: { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6,  amount: 66n  * 10n**6n  },
  },
};

const BSC = {
  rpc:   process.env.BSC_RPC,
  vault: process.env.BSC_VAULT_ADDRESS,
  tokens: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, amount: 71n * 10n**18n },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, amount: 34n * 10n**18n },
  },
};

async function withdrawChain(chainCfg, chainName) {
  const provider = new ethers.JsonRpcProvider(chainCfg.rpc);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  const vault    = new ethers.Contract(chainCfg.vault, VAULT_ABI, signer);

  console.log(`\n── ${chainName} vault: ${chainCfg.vault} ──`);

  for (const [symbol, token] of Object.entries(chainCfg.tokens)) {
    const erc20 = new ethers.Contract(token.address, ERC20_ABI, provider);
    const vaultBal = await erc20.balanceOf(chainCfg.vault);
    const human = ethers.formatUnits(vaultBal, token.decimals);
    console.log(`  ${symbol} vault balance: ${human}`);

    if (vaultBal < token.amount) {
      console.log(`  ⚠ Not enough ${symbol} in vault (have ${human}, want ${ethers.formatUnits(token.amount, token.decimals)}) — skipping`);
      continue;
    }

    console.log(`  Withdrawing ${ethers.formatUnits(token.amount, token.decimals)} ${symbol} → ${DEV_WALLET}…`);
    try {
      const tx = await vault.removeLiquidity(token.address, token.amount);
      console.log(`  tx: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ Done`);
    } catch (e) {
      console.error(`  ✗ Failed: ${e.shortMessage || e.message}`);
    }
  }
}

(async () => {
  await withdrawChain(BASE, 'Base');
  await withdrawChain(BSC,  'BSC');
  console.log('\nAll done.');
})();

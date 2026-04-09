import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

export const CHAINS = {
  1:    { name: 'Ethereum',      rpc: 'https://eth.llamarpc.com',             symbol: 'ETH', explorer: 'https://etherscan.io/tx/' },
  8453: { name: 'Base',          rpc: 'https://mainnet.base.org',             symbol: 'ETH', explorer: 'https://basescan.org/tx/' },
  56:   { name: 'BSC',           rpc: 'https://bsc-dataseed.binance.org',     symbol: 'BNB', explorer: 'https://bscscan.com/tx/'  },
  964:  { name: 'Bittensor EVM', rpc: 'https://lite.chain.opentensor.ai',    symbol: 'TAO', explorer: 'https://evm.taostats.io/tx/' },
};

const BITTENSOR_CHAIN_PARAMS = {
  chainId: '0x3C4',           // 964 in hex
  chainName: 'Bittensor EVM',
  nativeCurrency: { name: 'TAO', symbol: 'TAO', decimals: 18 },
  rpcUrls: ['https://lite.chain.opentensor.ai'],
  blockExplorerUrls: ['https://evm.taostats.io'],
};

export function useWallet() {
  const [address,  setAddress]  = useState(null);
  const [chainId,  setChainId]  = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer,   setSigner]   = useState(null);

  const _refresh = useCallback(async (browserProvider) => {
    const s       = await browserProvider.getSigner();
    const addr    = await s.getAddress();
    const network = await browserProvider.getNetwork();
    setProvider(browserProvider);
    setSigner(s);
    setAddress(addr);
    setChainId(Number(network.chainId));
  }, []);

  // Add Bittensor EVM to MetaMask and switch to it
  const switchToBittensor = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BITTENSOR_CHAIN_PARAMS.chainId }],
      });
    } catch (err) {
      if (err.code === 4902 || err.code === -32603) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BITTENSOR_CHAIN_PARAMS],
        });
      }
    }
  }, []);

  // Connect wallet → always lands on Bittensor EVM
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('MetaMask not found. Please install MetaMask.');
      return;
    }
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      // Switch to Bittensor EVM after connecting
      await switchToBittensor();
      const bp = new ethers.BrowserProvider(window.ethereum);
      await _refresh(bp);
    } catch (err) {
      console.error('Connect error:', err);
    }
  }, [switchToBittensor, _refresh]);

  const switchChain = useCallback(async (targetChainId) => {
    if (!window.ethereum) return;
    if (targetChainId === 964) { await switchToBittensor(); return; }
    const hexId = '0x' + targetChainId.toString(16);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexId }],
      });
    } catch (err) {
      if (err.code === 4902) {
        const cfg = CHAINS[targetChainId];
        if (!cfg) return;
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hexId,
            chainName: cfg.name,
            nativeCurrency: { name: cfg.symbol, symbol: cfg.symbol, decimals: 18 },
            rpcUrls: [cfg.rpc],
          }],
        });
      }
    }
  }, [switchToBittensor]);

  const disconnect = useCallback(() => {
    setAddress(null); setChainId(null); setProvider(null); setSigner(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect();
      else {
        const bp = new ethers.BrowserProvider(window.ethereum);
        _refresh(bp).catch(console.error);
      }
    };

    const onChainChanged = () => {
      const bp = new ethers.BrowserProvider(window.ethereum);
      _refresh(bp).catch(console.error);
    };

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);

    // Auto-reconnect if already authorized
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length > 0) {
        const bp = new ethers.BrowserProvider(window.ethereum);
        _refresh(bp).catch(console.error);
      }
    });

    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged', onChainChanged);
    };
  }, [_refresh, disconnect]);

  return { address, chainId, provider, signer, connect, disconnect, switchChain };
}

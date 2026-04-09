import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID || '';

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

  // Connect wallet — forces account picker even if already connected
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('No wallet found. Please install MetaMask or another EVM wallet.');
      return;
    }
    try {
      // wallet_requestPermissions forces the account selector to appear
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // fallback for wallets that don't support wallet_requestPermissions
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
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

  // WalletConnect v2
  const connectWC = useCallback(async () => {
    if (!WC_PROJECT_ID) throw new Error('No WalletConnect Project ID configured');
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
    const wcProvider = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      chains: [964],
      optionalChains: [1, 8453, 56],
      showQrModal: true,
      metadata: {
        name: 'TAOflow Bridge',
        description: 'TAOflow Bridge & DEX',
        url: 'https://taoflowbridge.xyz',
        icons: ['https://taoflowbridge.xyz/favicon.png'],
      },
    });
    await wcProvider.connect();
    const bp = new ethers.BrowserProvider(wcProvider);
    await _refresh(bp);
  }, [_refresh]);

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

  return { address, chainId, provider, signer, connect, connectWC, disconnect, switchChain, hasWC: !!WC_PROJECT_ID };
}

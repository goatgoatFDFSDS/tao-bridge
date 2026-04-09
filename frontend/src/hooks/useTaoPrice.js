import { useState, useEffect } from 'react';

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bittensor&vs_currencies=usd&include_24hr_change=true';

export function useTaoPrice() {
  const [price,     setPrice]     = useState(null);
  const [change24h, setChange24h] = useState(null);
  const [loading,   setLoading]   = useState(true);

  const fetchPrice = async () => {
    try {
      const res  = await fetch(COINGECKO_URL);
      const data = await res.json();
      const tao  = data?.bittensor;
      if (tao) {
        setPrice(tao.usd);
        setChange24h(tao.usd_24h_change);
      }
    } catch {
      // silently fail — keep last value
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, 30_000);
    return () => clearInterval(id);
  }, []);

  return { price, change24h, loading };
}

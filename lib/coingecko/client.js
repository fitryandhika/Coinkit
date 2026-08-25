import { getCache, setCache } from "@/lib/bitget/cache";

const BASE_URL = "https://api.coingecko.com/api/v3";
const CACHE_KEY = "coingecko:global";
// Data global tidak perlu realtime, sekaligus jaga rate limit gratis CoinGecko
// (nol biaya, tidak butuh API key — endpoint publik).
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getGlobalMarketData() {
  const cached = getCache(CACHE_KEY);
  if (cached && cached.ageMs < CACHE_TTL_MS) return { ...cached.value, stale: false };

  try {
    const res = await fetch(`${BASE_URL}/global`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const json = await res.json();
    const data = json.data;

    const result = {
      totalMarketCapUsd: data?.total_market_cap?.usd ?? null,
      marketCapChangePct24h: data?.market_cap_change_percentage_24h_usd ?? null,
      btcDominancePct: data?.market_cap_percentage?.btc ?? null,
    };

    setCache(CACHE_KEY, result);
    return { ...result, stale: false };
  } catch (err) {
    if (cached) return { ...cached.value, stale: true, error: err.message };
    throw err;
  }
}

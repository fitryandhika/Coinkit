import { analyzeSymbol } from "@/lib/technical/analyzer";
import { getCache, setCache } from "@/lib/bitget/cache";
import { AI_CONFIG } from "./config";

async function classifyAsset(symbol, market) {
  const report = await analyzeSymbol({ symbol, market, timeframe: "4h" });
  if (report.dataQuality === "INSUFFICIENT_DATA") return { trend: "UNKNOWN", volatilityLabel: "UNKNOWN" };
  return { trend: report.trend.mediumTerm, volatilityLabel: report.indicators.atrLabel };
}

export async function getMarketRegime({ market = "futures", config = AI_CONFIG } = {}) {
  const cacheKey = `ai:marketRegime:${market}`;
  const cached = getCache(cacheKey);
  if (cached && cached.ageMs < config.MARKET_REGIME_CACHE_TTL_MS) return cached.value;

  const [btc, eth] = await Promise.all([
    classifyAsset("BTCUSDT", market).catch(() => ({ trend: "UNKNOWN", volatilityLabel: "UNKNOWN" })),
    classifyAsset("ETHUSDT", market).catch(() => ({ trend: "UNKNOWN", volatilityLabel: "UNKNOWN" })),
  ]);

  const trends = [btc.trend, eth.trend];
  const bullishCount = trends.filter((t) => t === "BULLISH" || t === "WEAK_BULLISH").length;
  const bearishCount = trends.filter((t) => t === "BEARISH" || t === "WEAK_BEARISH").length;

  let regime = "UNKNOWN";
  if (bullishCount === 2) regime = "BULL";
  else if (bearishCount === 2) regime = "BEAR";
  else if (bullishCount + bearishCount > 0) regime = "SIDEWAYS";

  const highVol = [btc.volatilityLabel, eth.volatilityLabel].some((v) => v === "HIGH" || v === "EXTREME");
  const riskTag = highVol ? "HIGH_VOLATILITY" : regime === "BULL" ? "RISK_ON" : regime === "BEAR" ? "RISK_OFF" : "UNKNOWN";

  const result = { regime, riskTag, btcTrend: btc.trend, ethTrend: eth.trend, btcVolatility: btc.volatilityLabel, ethVolatility: eth.volatilityLabel };
  setCache(cacheKey, result);
  return result;
}

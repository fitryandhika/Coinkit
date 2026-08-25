import { getSpotSymbols, getSpotTickers, getSpotCandles } from "@/lib/bitget/spot";
import { getFuturesSymbols, getFuturesTickers, getFuturesCandles } from "@/lib/bitget/futures";
import { getCache, setCache } from "@/lib/bitget/cache";
import { SCREENER_CONFIG } from "./config";
import { computeMomentum, computeMomentumScore, describeMomentum } from "./momentum";
import { computeVolumeRatio, describeVolume, computeVolumeScore } from "./volume";
import { computeVolatility, describeVolatility, computeVolatilityScore } from "./volatility";
import { computeSpreadPct, describeLiquidity, computeLiquidityScore } from "./liquidity";
import { computeBreakout } from "./breakout";
import { computeExhaustion } from "./exhaustion";
import { calculateScreenerScore, calculatePenalties } from "./ranking";
import { buildReasons } from "./reasons";

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(workers);
  return results;
}

function buildUniverse(symbols, tickers, config) {
  const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));

  return symbols
    .filter((s) => s.status === "trading")
    .filter((s) => s.quote === "USDT")
    .map((s) => ({ ...s, ticker: tickerMap.get(s.symbol) || null }))
    .filter((s) => s.ticker && s.ticker.price !== null)
    .filter((s) => (s.ticker.volume24h ?? 0) >= config.MIN_VALID_VOLUME_USDT);
}

function buildScreenerEntry(item, candles, timeframe, config) {
  const ticker = item.ticker;

  const momentum = computeMomentum(candles);
  const momentumLabel = describeMomentum(momentum.m1, config);
  const momentumScore = computeMomentumScore(momentum, config);

  const { volumeRatio } = computeVolumeRatio(candles);
  const volumeLabel = describeVolume(volumeRatio, config);
  const volumeScore = computeVolumeScore(volumeRatio, config);

  const volatility = computeVolatility(candles);
  const volatilityLabel = describeVolatility(volatility.volatilityPct, config);
  const volatilityScore = computeVolatilityScore(volatility.volatilityPct, config);

  const spreadPct = computeSpreadPct(ticker.bid, ticker.ask);
  const liquidityLabel = describeLiquidity(ticker.volume24h, spreadPct, config);
  const liquidityScore = computeLiquidityScore(ticker.volume24h, spreadPct, config);

  const breakout = computeBreakout(candles, config);
  const exhaustion = computeExhaustion(candles, momentum, volumeRatio, volatility, config);

  const penalties = calculatePenalties(
    { liquidityLabel, spreadPct, volumeLabel, volatilityLabel, exhaustionStatus: exhaustion.status },
    config
  );

  const { rawScore, penalty, finalScore } = calculateScreenerScore(
    { momentumScore, volumeScore, liquidityScore, volatilityScore, breakoutScore: breakout.breakoutScore },
    penalties,
    config
  );

  const reasons = buildReasons({
    timeframe,
    momentum,
    momentumLabel,
    volumeRatio,
    volumeLabel,
    liquidityLabel,
    breakout,
    exhaustion,
  });

  return {
    symbol: item.symbol,
    market: ticker.market,
    timeframe,
    price: ticker.price,
    change24h: ticker.change24h,
    volume24h: ticker.volume24h,

    screenerScore: finalScore,
    rawScore,
    penalty,
    penalties,

    momentumScore,
    volumeScore,
    liquidityScore,
    volatilityScore,
    breakoutScore: breakout.breakoutScore,

    momentum,
    momentumLabel,
    volumeRatio,
    volumeLabel,
    volatility,
    volatilityLabel,
    liquidityLabel,
    spreadPct,
    breakout,
    exhaustion,

    reasons,
  };
}

export async function runScreener({ mode, timeframe, config = SCREENER_CONFIG }) {
  const isFutures = mode === "futures";

  const [symbolsResult, tickersResult] = await Promise.all([
    isFutures ? getFuturesSymbols() : getSpotSymbols(),
    isFutures ? getFuturesTickers() : getSpotTickers(),
  ]);

  const universe = buildUniverse(symbolsResult.symbols, tickersResult.tickers, config);

  const candidates = [...universe]
    .sort((a, b) => (b.ticker.volume24h ?? 0) - (a.ticker.volume24h ?? 0))
    .slice(0, config.CANDLE_UNIVERSE_LIMIT);

  const getCandles = isFutures ? getFuturesCandles : getSpotCandles;
  const candleExtraOptions = {
    timeoutMs: config.CANDLE_FETCH_TIMEOUT_MS,
    retries: config.CANDLE_FETCH_RETRIES,
  };

  const results = await mapWithConcurrency(candidates, config.CONCURRENCY_LIMIT, async (item) => {
    try {
      const { candles } = isFutures
        ? await getCandles(item.symbol, timeframe, undefined, config.CANDLE_COUNT, candleExtraOptions)
        : await getCandles(item.symbol, timeframe, config.CANDLE_COUNT, candleExtraOptions);
      return buildScreenerEntry(item, candles, timeframe, config);
    } catch (err) {
      return {
        symbol: item.symbol,
        market: mode,
        timeframe,
        price: item.ticker.price,
        change24h: item.ticker.change24h,
        volume24h: item.ticker.volume24h,
        screenerScore: null,
        error: "Candle data unavailable",
      };
    }
  });

  return {
    mode,
    timeframe,
    universeCount: universe.length,
    scannedCount: candidates.length,
    results: results.filter(Boolean).sort((a, b) => (b.screenerScore ?? -1) - (a.screenerScore ?? -1)),
  };
}

export async function runScreenerCached({ mode, timeframe, config = SCREENER_CONFIG }) {
  const cacheKey = `screener:${mode}:${timeframe}`;
  const cached = getCache(cacheKey);
  if (cached && cached.ageMs < config.SCREENER_CACHE_TTL_MS) {
    return { ...cached.value, fromCache: true };
  }

  const result = await runScreener({ mode, timeframe, config });
  setCache(cacheKey, result);
  return { ...result, fromCache: false };
}

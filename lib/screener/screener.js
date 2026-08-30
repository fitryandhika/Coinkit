import { getSpotSymbols, getSpotTickers, getSpotCandles } from "@/lib/bitget/spot";
import { getFuturesSymbols, getFuturesTickers, getFuturesCandles } from "@/lib/bitget/futures";
import { getCache, setCache } from "@/lib/bitget/cache";
import { SCREENER_CONFIG } from "./config";
import { computeMomentum, computeMomentumRate, describeMomentum, computeDirectionalMomentumScore } from "./momentum";
import { computeVolumeRatio, describeVolume, computeVolumeScore } from "./volume";
import { computeVolatility, describeVolatility, computeVolatilityScore } from "./volatility";
import { computeSpreadPct, describeLiquidity, computeLiquidityScore } from "./liquidity";
import { computeStructureBreak, computeStructureBreakScore } from "./breakout";
import { computeExhaustion } from "./exhaustion";
import { calculateScreenerScore, calculatePenalties } from "./ranking";
import { computeEntryQuality, computeEntryAdjustedScore } from "./entryQuality";
import { buildReasons } from "./reasons";
import { inferDirection, buildTradeIdea } from "./tradeIdea";
import { autoRecordIfEligible } from "./autoRecord";
import { toReturns, computeCorrelation } from "./correlation";
import { resolveTrailMultiplier } from "./adaptiveTrail";
import { detectSupportResistance } from "@/lib/technical/supportResistance";
import { analyzeStructure } from "@/lib/technical/structure";
import { atr as computeAtrSeries } from "@/lib/technical/indicators";

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

/** Ambil candle BTC SEKALI untuk seluruh run screener — dipakai basis korelasi &
 * momentum pasar utama untuk semua coin. Kalau gagal, fallback netral (tidak
 * menggagalkan seluruh screener). */
async function fetchBtcContext({ mode, timeframe, config }) {
  const isFutures = mode === "futures";
  const getCandles = isFutures ? getFuturesCandles : getSpotCandles;
  const candleExtraOptions = { timeoutMs: config.CANDLE_FETCH_TIMEOUT_MS, retries: config.CANDLE_FETCH_RETRIES };

  try {
    const { candles } = isFutures
      ? await getCandles("BTCUSDT", timeframe, undefined, config.CANDLE_COUNT, candleExtraOptions)
      : await getCandles("BTCUSDT", timeframe, config.CANDLE_COUNT, candleExtraOptions);
    const closes = candles.map((c) => c.close);
    const momentumRate = computeMomentumRate(computeMomentum(candles), config);
    return { closes, momentumLabel: describeMomentum(momentumRate.rate, config) };
  } catch (err) {
    return { closes: [], momentumLabel: "UNKNOWN" };
  }
}

function buildScreenerEntry(item, candles, timeframe, config, btcContext) {
  const ticker = item.ticker;

  // --- 1. Ukuran mentah (belum ada arah) --------------------------------
  const momentum = computeMomentum(candles);
  const momentumRate = computeMomentumRate(momentum, config);
  const momentumLabel = describeMomentum(momentumRate.rate, config);

  const { volumeRatio } = computeVolumeRatio(candles, { lookback: config.VOLUME_AVG_LOOKBACK });
  const volumeLabel = describeVolume(volumeRatio, config);
  const volumeScore = computeVolumeScore(volumeRatio, config);

  const volatility = computeVolatility(candles, { lookback: config.VOLATILITY_LOOKBACK });
  const volatilityLabel = describeVolatility(volatility.volatilityPct, config);
  const volatilityScore = computeVolatilityScore(volatility.volatilityPct, config);

  const spreadPct = computeSpreadPct(ticker.bid, ticker.ask);
  const liquidityLabel = describeLiquidity(ticker.volume24h, spreadPct, config);
  const liquidityScore = computeLiquidityScore(ticker.volume24h, spreadPct, config);

  const structureBreak = computeStructureBreak(candles, config);
  const exhaustion = computeExhaustion(candles, momentum, volumeRatio, volatility, config);

  // --- 2. ARAH DITENTUKAN DI SINI, SEBELUM SCORING ----------------------
  // Ini perubahan urutan yang wajib: momentumScore & breakoutScore sekarang
  // relatif terhadap arah setup, jadi arah harus sudah diketahui lebih dulu.
  const direction = inferDirection({
    momentumLabel,
    breakoutStatus: structureBreak.status,
    structureBias: structureBreak.bias,
  });

  // --- 3. Skor yang bergantung arah -------------------------------------
  const momentumScore = computeDirectionalMomentumScore(momentumRate, direction, config);
  const breakoutScore = computeStructureBreakScore(structureBreak, direction);
  structureBreak.breakoutScore = breakoutScore;

  // --- 4. Level entry / SL / TP -----------------------------------------
  const structure = analyzeStructure(candles);
  const { support, resistance } = detectSupportResistance(candles);
  const atrValue = candles.length >= 15 ? computeAtrSeries(candles, 14).slice(-1)[0] ?? null : null;

  // Korelasi terhadap BTC + trail multiplier adaptif (dikunci di sini, saat prediction dicatat)
  const closes = candles.map((c) => c.close);
  const returns = toReturns(closes).slice(-config.CORRELATION_LOOKBACK);
  const btcReturns = toReturns(btcContext.closes).slice(-config.CORRELATION_LOOKBACK);
  const btcCorrelation = computeCorrelation(returns, btcReturns, config.MIN_CORRELATION_SAMPLE);
  const trailMultiplier = resolveTrailMultiplier({
    direction,
    btcCorrelation,
    btcMomentumLabel: btcContext.momentumLabel,
    config,
  });

  const tradeIdea = buildTradeIdea({
    price: ticker.price,
    direction,
    market: ticker.market,
    support,
    resistance,
    structure,
    atr: atrValue,
  });

  // --- 5. Kelayakan harga entry SAAT INI ---------------------------------
  // Dihitung setelah tradeIdea karena butuh SL/TP untuk mengukur sisa ruang
  // untung, dan hasilnya ikut menentukan penalti di langkah berikutnya.
  const entryQuality = computeEntryQuality({
    price: ticker.price,
    direction,
    candles,
    breakout: structureBreak,
    tradeIdea,
    atr: atrValue,
    config,
  });

  // --- 6. Penalti & skor akhir ------------------------------------------
  const penalties = calculatePenalties(
    {
      liquidityLabel,
      spreadPct,
      volumeLabel,
      volatilityLabel,
      exhaustionStatus: exhaustion.status,
      entryLabel: entryQuality.entryLabel,
    },
    config
  );

  const { rawScore, penalty, finalScore } = calculateScreenerScore(
    { momentumScore, volumeScore, liquidityScore, volatilityScore, breakoutScore },
    penalties,
    config
  );

  const entryAdjustedScore = computeEntryAdjustedScore(finalScore, entryQuality.entryScore, config);

  const reasons = buildReasons({
    timeframe,
    momentum,
    momentumRate,
    momentumLabel,
    volumeRatio,
    volumeLabel,
    liquidityLabel,
    breakout: structureBreak,
    exhaustion,
    entryQuality,
  });

  return {
    symbol: item.symbol,
    market: ticker.market,
    timeframe,
    price: ticker.price,
    change24h: ticker.change24h,
    volume24h: ticker.volume24h,

    screenerScore: finalScore,
    entryAdjustedScore,
    rawScore,
    penalty,
    penalties,

    momentumScore,
    volumeScore,
    liquidityScore,
    volatilityScore,
    breakoutScore,

    momentum,
    momentumRate: momentumRate.rate,
    momentumAligned: momentumRate.aligned,
    momentumLabel,
    volumeRatio,
    volumeLabel,
    volatility,
    volatilityLabel,
    liquidityLabel,
    spreadPct,
    breakout: structureBreak,
    structureBias: structureBreak.bias,
    exhaustion,

    direction,
    tradeIdea,
    entryQuality,
    entryScore: entryQuality.entryScore,
    entryLabel: entryQuality.entryLabel,
    riskReward: entryQuality.riskReward,
    atr: atrValue,
    btcCorrelation,
    trailMultiplier,

    reasons,
  };
}

export async function runScreener({ mode, timeframe, config = SCREENER_CONFIG }) {
  const isFutures = mode === "futures";

  const [symbolsResult, tickersResult, btcContext] = await Promise.all([
    isFutures ? getFuturesSymbols() : getSpotSymbols(),
    isFutures ? getFuturesTickers() : getSpotTickers(),
    fetchBtcContext({ mode, timeframe, config }),
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
      const entry = buildScreenerEntry(item, candles, timeframe, config, btcContext);
      autoRecordIfEligible({ mode, timeframe, entry, btcMomentumLabel: btcContext.momentumLabel }).catch(() => {});
      return entry;
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
    btcMomentumLabel: btcContext.momentumLabel,
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

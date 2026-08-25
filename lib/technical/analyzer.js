import { getSpotCandles, getSpotTickers } from "@/lib/bitget/spot";
import { getFuturesCandles, getFuturesTickers } from "@/lib/bitget/futures";
import { getCache, setCache } from "@/lib/bitget/cache";

import { sma, ema, rsi as computeRsi, macd as computeMacd, atr as computeAtr, bollinger as computeBollinger, adx as computeAdx, vwap as computeVwap } from "./indicators";
import { analyzeTrend } from "./trend";
import { classifyRSI, classifyMACD } from "./momentum";
import { classifyATR, analyzeBollinger, classifyBandWidth } from "./volatility";
import { analyzeVolume } from "./volume";
import { analyzeStructure } from "./structure";
import { detectSupportResistance } from "./supportResistance";
import {
  computeTrendScore,
  computeMomentumScore,
  computeVolumeScore,
  computeVolatilityScore,
  computeStructureScore,
  calculateTechnicalScore,
  detectConflicts,
} from "./score";
import { TECHNICAL_CONFIG } from "./config";

function last(arr) {
  if (!arr || arr.length === 0) return null;
  const v = arr[arr.length - 1];
  return v === undefined ? null : v;
}
function secondLast(arr) {
  if (!arr || arr.length < 2) return null;
  const v = arr[arr.length - 2];
  return v === undefined ? null : v;
}

async function fetchCandles(market, symbol, timeframe, limit) {
  return market === "futures"
    ? (await getFuturesCandles(symbol, timeframe, undefined, limit)).candles
    : (await getSpotCandles(symbol, timeframe, limit)).candles;
}

async function fetchPrice(market, symbol) {
  const { tickers } = market === "futures" ? await getFuturesTickers(symbol) : await getSpotTickers(symbol);
  return tickers[0]?.price ?? null;
}

function analyzeBreakoutStatus({ candles, resistance }) {
  if (!candles || candles.length < 2 || !resistance || resistance.length === 0) {
    return { status: "UNKNOWN", nearestResistance: null, distancePct: null };
  }
  const nearestResistance = resistance[0];
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  if (current.close === null || previous.close === null) {
    return { status: "UNKNOWN", nearestResistance: null, distancePct: null };
  }

  const distancePct = Number((((current.close - nearestResistance) / nearestResistance) * 100).toFixed(4));
  const currentAbove = current.close > nearestResistance;
  const previousAbove = previous.close > nearestResistance;

  let status;
  if (currentAbove && previousAbove) status = "ABOVE_RESISTANCE";
  else if (currentAbove && !previousAbove) status = "BREAKOUT";
  else if (!currentAbove && previousAbove) status = "FAILED_BREAKOUT";
  else if (distancePct >= -1.5) status = "TESTING_RESISTANCE";
  else status = "BELOW_RESISTANCE";

  return { status, nearestResistance, distancePct };
}

function buildReasons({ trend, rsiLabel, adxValue, structure, macdState }) {
  const reasons = [];

  if (trend.mediumTerm === "BULLISH" || trend.mediumTerm === "WEAK_BULLISH") reasons.push("Price above EMA20 and EMA50");
  if (trend.mediumTerm === "BEARISH" || trend.mediumTerm === "WEAK_BEARISH") reasons.push("Price below EMA20 and EMA50");

  if (rsiLabel === "STRONG") reasons.push("RSI indicates strong momentum");
  else if (rsiLabel === "OVERSOLD") reasons.push("RSI indicates oversold condition");
  else if (rsiLabel === "OVERBOUGHT") reasons.push("RSI indicates overbought condition");

  if (adxValue !== null && adxValue !== undefined) {
    if (adxValue >= 40) reasons.push("ADX indicates very strong trend");
    else if (adxValue >= 25) reasons.push("ADX indicates strong trend");
    else if (adxValue >= 20) reasons.push("ADX indicates developing trend");
  }

  if (structure.higherHigh && structure.higherLow) reasons.push("Higher-high / higher-low structure detected");
  if (structure.lowerHigh && structure.lowerLow) reasons.push("Lower-high / lower-low structure detected");

  if (macdState === "BULLISH_MOMENTUM") reasons.push("MACD histogram shows bullish momentum");
  if (macdState === "BEARISH_MOMENTUM") reasons.push("MACD histogram shows bearish momentum");

  return reasons;
}

export async function analyzeSymbol({ symbol, market, timeframe, config = TECHNICAL_CONFIG }) {
  const candles = await fetchCandles(market, symbol, timeframe, config.CANDLE_COUNT);
  const price = await fetchPrice(market, symbol);

  if (!candles || candles.length < config.MIN_CANDLES_OVERALL) {
    return { symbol, market, timeframe, price, dataQuality: "INSUFFICIENT_DATA" };
  }

  const closes = candles.map((c) => c.close);

  const smaSeries = {};
  config.SMA_PERIODS.forEach((period) => {
    smaSeries[period] = candles.length >= period ? last(sma(closes, period)) : null;
  });

  const emaSeries = {};
  config.EMA_PERIODS.forEach((period) => {
    emaSeries[period] = candles.length >= period ? last(ema(closes, period)) : null;
  });

  const rsiValue = candles.length >= config.RSI_PERIOD + 1 ? last(computeRsi(closes, config.RSI_PERIOD)) : null;
  const rsiLabel = classifyRSI(rsiValue);

  const macdResult = computeMacd(closes, config.MACD_FAST, config.MACD_SLOW, config.MACD_SIGNAL);
  const macdValue = last(macdResult.macdLine);
  const signalValue = last(macdResult.signalLine);
  const histogram = last(macdResult.histogram);
  const prevHistogram = secondLast(macdResult.histogram);
  const macdClassification = classifyMACD({ macdValue, signalValue, histogram, prevHistogram });

  const atrValue = candles.length >= config.ATR_PERIOD + 1 ? last(computeAtr(candles, config.ATR_PERIOD)) : null;
  const atrPercent = atrValue !== null && price ? Number(((atrValue / price) * 100).toFixed(4)) : null;
  const atrLabel = classifyATR(atrPercent);

  const bollingerSeries = computeBollinger(closes, config.BOLLINGER_PERIOD, config.BOLLINGER_STDDEV);
  const bollingerNow = { upper: last(bollingerSeries.upper), middle: last(bollingerSeries.middle), lower: last(bollingerSeries.lower) };
  const bollingerPrev = { upper: secondLast(bollingerSeries.upper), middle: secondLast(bollingerSeries.middle), lower: secondLast(bollingerSeries.lower) };
  const bollingerAnalysis = analyzeBollinger({ price, ...bollingerNow });
  const prevBollingerAnalysis = analyzeBollinger({ price: bollingerPrev.middle, ...bollingerPrev });
  const bandWidthTrend = classifyBandWidth(bollingerAnalysis.width, prevBollingerAnalysis.width);

  const adxValue = candles.length >= config.MIN_CANDLES_FOR_ADX ? last(computeAdx(candles, config.ADX_PERIOD)) : null;
  const adxLabel =
    adxValue === null ? "UNKNOWN" : adxValue < 20 ? "WEAK" : adxValue < 25 ? "DEVELOPING" : adxValue < 40 ? "STRONG" : "VERY_STRONG";

  const volumeAnalysis = analyzeVolume(candles);

  const vwapValue = last(computeVwap(candles));
  const distanceFromVwap = vwapValue && price ? Number((((price - vwapValue) / vwapValue) * 100).toFixed(4)) : null;
  let vwapPosition = "UNKNOWN";
  if (distanceFromVwap !== null) {
    vwapPosition = distanceFromVwap > 0.2 ? "ABOVE_VWAP" : distanceFromVwap < -0.2 ? "BELOW_VWAP" : "NEAR_VWAP";
  }

  const structure = analyzeStructure(candles);
  const { support, resistance } = detectSupportResistance(candles);

  const trend = analyzeTrend({
    price,
    ema9: emaSeries[9],
    ema20: emaSeries[20],
    ema50: emaSeries[50],
    ema200: emaSeries[200],
    structureLabel: structure.marketStructure,
    adxValue,
  });

  const breakout = analyzeBreakoutStatus({ candles, resistance });

  const trendScore = computeTrendScore(trend, adxValue);
  const momentumScore = computeMomentumScore(rsiValue, macdClassification.state);
  const volumeScore = computeVolumeScore(volumeAnalysis.volumeRatio, config);
  const volatilityScore = computeVolatilityScore(atrPercent, config);
  const structureScore = computeStructureScore(structure.marketStructure);

  const technicalScore = calculateTechnicalScore({ trendScore, momentumScore, volumeScore, volatilityScore, structureScore }, config);

  const { agreement, conflicts } = detectConflicts({
    trend,
    rsiLabel,
    macdState: macdClassification.state,
    marketStructure: structure.marketStructure,
  });

  const reasons = buildReasons({ trend, rsiLabel, adxValue, structure, macdState: macdClassification.state });

  const insufficientHighPeriod = [smaSeries[200], emaSeries[200], adxValue].some((v) => v === null);

  return {
    symbol,
    market,
    timeframe,
    price,
    dataQuality: insufficientHighPeriod ? "PARTIAL_DATA" : "OK",

    trend,

    indicators: {
      sma: smaSeries,
      ema: emaSeries,
      rsi: rsiValue,
      rsiLabel,
      macd: { macd: macdValue, signal: signalValue, histogram, histogramTrend: macdClassification.histogramTrend, state: macdClassification.state },
      atr: atrValue,
      atrPercent,
      atrLabel,
      bollinger: { ...bollingerNow, width: bollingerAnalysis.width, percentB: bollingerAnalysis.percentB, position: bollingerAnalysis.position, bandWidthTrend },
      adx: adxValue,
      adxLabel,
      vwap: vwapValue,
      distanceFromVwap,
      vwapPosition,
      volume: volumeAnalysis,
    },

    structure,
    support,
    resistance,
    breakout,

    technicalScore,
    scoreBreakdown: { trendScore, momentumScore, volumeScore, volatilityScore, structureScore },

    indicatorAgreement: agreement,
    conflicts,

    reasons,
  };
}

export async function analyzeMultiTimeframe({ symbol, market, config = TECHNICAL_CONFIG }) {
  const timeframes = config.MULTI_TIMEFRAME_SET;

  const perTimeframe = await Promise.all(
    timeframes.map(async (timeframe) => {
      try {
        const candles = await fetchCandles(market, symbol, timeframe, 60);
        if (!candles || candles.length < 30) return { timeframe, trend: "UNKNOWN" };

        const closes = candles.map((c) => c.close);
        const ema20 = last(ema(closes, 20));
        const ema50 = last(ema(closes, 50));
        const price = closes[closes.length - 1];

        let trend = "UNKNOWN";
        if (ema20 !== null && ema50 !== null && price !== null) {
          if (ema20 > ema50 && price > ema20) trend = "BULLISH";
          else if (ema20 < ema50 && price < ema20) trend = "BEARISH";
          else trend = "NEUTRAL";
        }
        return { timeframe, trend };
      } catch (err) {
        return { timeframe, trend: "UNKNOWN" };
      }
    })
  );

  const known = perTimeframe.filter((t) => t.trend !== "UNKNOWN");
  let alignment = "UNKNOWN";
  if (known.length > 0) {
    const bullishCount = known.filter((t) => t.trend === "BULLISH").length;
    const bearishCount = known.filter((t) => t.trend === "BEARISH").length;
    const ratio = Math.max(bullishCount, bearishCount) / known.length;
    alignment = ratio >= config.MULTI_TIMEFRAME_HIGH_THRESHOLD ? "HIGH" : "LOW";
  }

  const byTimeframe = {};
  perTimeframe.forEach((t) => {
    byTimeframe[t.timeframe] = t.trend;
  });

  return { byTimeframe, alignment };
}

export async function getTechnicalReport({ symbol, market, timeframe, config = TECHNICAL_CONFIG }) {
  const cacheKey = `technical:${market}:${symbol}:${timeframe}`;
  const ttl = config.ANALYSIS_CACHE_TTL_MS[timeframe] ?? 60000;

  const cached = getCache(cacheKey);
  if (cached && cached.ageMs < ttl) {
    return { ...cached.value, fromCache: true };
  }

  const [report, multiTimeframe] = await Promise.all([
    analyzeSymbol({ symbol, market, timeframe, config }),
    analyzeMultiTimeframe({ symbol, market, config }),
  ]);

  const result = { ...report, multiTimeframe };
  setCache(cacheKey, result);
  return { ...result, fromCache: false };
}

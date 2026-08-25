import { getSpotCandles } from "@/lib/bitget/spot";
import { getFuturesCandles } from "@/lib/bitget/futures";
import { OUTCOME_CONFIG } from "./config";

function granularityForElapsed(hoursElapsed) {
  if (hoursElapsed <= 24) return "15m";
  if (hoursElapsed <= 96) return "1h";
  return "4h";
}

async function fetchCandlesSince(market, symbol, timeframe, sinceMs) {
  const { candles } = market === "futures"
    ? await getFuturesCandles(symbol, timeframe, undefined, OUTCOME_CONFIG.MAX_CANDLES_PER_CHECK)
    : await getSpotCandles(symbol, timeframe, OUTCOME_CONFIG.MAX_CANDLES_PER_CHECK);
  return candles.filter((c) => c.time >= sinceMs);
}

export async function fetchOutcomeCandles({ market, symbol, entryTimestamp, nowMs }) {
  const hoursElapsed = (nowMs - entryTimestamp) / (1000 * 60 * 60);
  const timeframe = granularityForElapsed(hoursElapsed);
  return fetchCandlesSince(market, symbol, timeframe, entryTimestamp);
}

export function evaluateOutcome({ direction, entry, stopLoss, tp1, tp2, tp3, candles }) {
  const empty = { maximumGainPct: null, maximumDrawdownPct: null, maximumGainPrice: null, maximumDrawdownPrice: null, maximumR: null, tp1Hit: false, tp2Hit: false, tp3Hit: false, slHit: false, tp1HitAt: null, tp2HitAt: null, tp3HitAt: null, slHitAt: null, outcome: "PENDING" };
  if (!candles || candles.length === 0 || entry === null) return empty;

  const isLong = direction === "LONG" || direction === "BUY";
  const riskDistance = stopLoss !== null ? Math.abs(entry - stopLoss) : null;

  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  let tp1HitAt = null, tp2HitAt = null, tp3HitAt = null, slHitAt = null;

  for (const candle of candles) {
    if (candle.high !== null && candle.high > highestHigh) highestHigh = candle.high;
    if (candle.low !== null && candle.low < lowestLow) lowestLow = candle.low;

    if (!slHitAt && stopLoss !== null) {
      if (isLong && candle.low !== null && candle.low <= stopLoss) slHitAt = candle.time;
      if (!isLong && candle.high !== null && candle.high >= stopLoss) slHitAt = candle.time;
    }

    if (isLong) {
      if (!tp1HitAt && tp1 !== null && candle.high !== null && candle.high >= tp1) tp1HitAt = candle.time;
      if (!tp2HitAt && tp2 !== null && candle.high !== null && candle.high >= tp2) tp2HitAt = candle.time;
      if (!tp3HitAt && tp3 !== null && candle.high !== null && candle.high >= tp3) tp3HitAt = candle.time;
    } else {
      if (!tp1HitAt && tp1 !== null && candle.low !== null && candle.low <= tp1) tp1HitAt = candle.time;
      if (!tp2HitAt && tp2 !== null && candle.low !== null && candle.low <= tp2) tp2HitAt = candle.time;
      if (!tp3HitAt && tp3 !== null && candle.low !== null && candle.low <= tp3) tp3HitAt = candle.time;
    }
  }

  if (highestHigh === -Infinity || lowestLow === Infinity) return empty;

  const maximumGainPct = isLong
    ? Number((((highestHigh - entry) / entry) * 100).toFixed(4))
    : Number((((entry - lowestLow) / entry) * 100).toFixed(4));
  const maximumDrawdownPct = isLong
    ? Number((((lowestLow - entry) / entry) * 100).toFixed(4))
    : Number((((entry - highestHigh) / entry) * 100).toFixed(4));
  const maximumGainPrice = isLong ? highestHigh : lowestLow;
  const maximumDrawdownPrice = isLong ? lowestLow : highestHigh;
  const maximumR = riskDistance ? Number(((Math.abs(maximumGainPct / 100) * entry) / riskDistance).toFixed(4)) : null;

  let outcome = "PENDING";
  if (slHitAt !== null && (tp1HitAt === null || slHitAt <= tp1HitAt)) outcome = "SL_HIT";
  else if (tp3HitAt) outcome = "TP3_HIT";
  else if (tp2HitAt) outcome = "TP2_HIT";
  else if (tp1HitAt) outcome = "TP1_HIT";
  else if (slHitAt !== null) outcome = "SL_HIT";

  return {
    maximumGainPct, maximumDrawdownPct, maximumGainPrice, maximumDrawdownPrice, maximumR,
    tp1Hit: Boolean(tp1HitAt), tp2Hit: Boolean(tp2HitAt), tp3Hit: Boolean(tp3HitAt), slHit: Boolean(slHitAt),
    tp1HitAt, tp2HitAt, tp3HitAt, slHitAt, outcome,
  };
}

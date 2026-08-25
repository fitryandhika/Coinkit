export function computeVolatility(candles) {
  if (!candles || candles.length < 2) return { atr: null, volatilityPct: null };

  const ranges = candles
    .map((c) => (c.high !== null && c.low !== null ? c.high - c.low : null))
    .filter((r) => r !== null);
  if (ranges.length === 0) return { atr: null, volatilityPct: null };

  const atr = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
  const lastClose = candles[candles.length - 1].close;
  const volatilityPct = lastClose ? Number(((atr / lastClose) * 100).toFixed(4)) : null;

  return { atr: Number(atr.toFixed(8)), volatilityPct };
}

export function describeVolatility(volatilityPct, config) {
  if (volatilityPct === null || volatilityPct === undefined) return "UNKNOWN";
  if (volatilityPct < config.VOLATILITY_LOW_MAX) return "LOW";
  if (volatilityPct < config.VOLATILITY_NORMAL_MAX) return "NORMAL";
  if (volatilityPct < config.VOLATILITY_HIGH_MAX) return "HIGH";
  return "EXTREME";
}

export function computeVolatilityScore(volatilityPct, config) {
  if (volatilityPct === null || volatilityPct === undefined) return null;
  const distance = Math.abs(volatilityPct - config.VOLATILITY_IDEAL_PCT);
  const bounded = Math.max(0, 100 - (distance / config.VOLATILITY_SCORE_SPREAD) * 100);
  return Number(bounded.toFixed(2));
}

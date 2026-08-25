export function detectPullback({ technical }) {
  const { indicators, structure, price } = technical;
  const ema20 = indicators.ema[20];
  const ema50 = indicators.ema[50];
  const vwap = indicators.vwap;

  if (price === null || ema20 === null || ema50 === null) {
    return { stage: "UNKNOWN", pullbackCandidate: false, direction: null };
  }

  const uptrend = ema20 > ema50 && structure.marketStructure !== "BEARISH_STRUCTURE";
  const downtrend = ema20 < ema50 && structure.marketStructure !== "BULLISH_STRUCTURE";
  const nearVwap = vwap !== null && Math.abs((price - vwap) / vwap) < 0.005;

  if (uptrend) {
    if (price < ema20 && (price >= ema20 * 0.97 || nearVwap)) return { stage: "PULLBACK", pullbackCandidate: true, direction: "LONG" };
    return { stage: "IMPULSE", pullbackCandidate: false, direction: "LONG" };
  }

  if (downtrend) {
    if (price > ema20 && (price <= ema20 * 1.03 || nearVwap)) return { stage: "PULLBACK", pullbackCandidate: true, direction: "SHORT" };
    return { stage: "IMPULSE", pullbackCandidate: false, direction: "SHORT" };
  }

  return { stage: "UNCLEAR", pullbackCandidate: false, direction: null };
}

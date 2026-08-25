export function analyzeTrend({ price, ema9, ema20, ema50, ema200, structureLabel, adxValue }) {
  return {
    shortTerm: classify({ price, fastEma: ema9, slowEma: ema20, adxValue }),
    mediumTerm: classify({ price, fastEma: ema20, slowEma: ema50, adxValue }),
    longTerm: classify({ price, fastEma: ema50, slowEma: ema200, structureLabel, adxValue }),
  };
}

function classify({ price, fastEma, slowEma, structureLabel, adxValue }) {
  if (fastEma === null || slowEma === null || price === null) return "UNKNOWN";

  const emaBullish = fastEma > slowEma;
  const priceAboveFast = price > fastEma;
  const priceBelowFast = price < fastEma;
  const structureBearish = structureLabel === "BEARISH_STRUCTURE";
  const structureBullish = structureLabel === "BULLISH_STRUCTURE";
  const weakTrend = adxValue !== null && adxValue !== undefined && adxValue < 20;

  if (emaBullish && priceAboveFast && !structureBearish) return weakTrend ? "WEAK_BULLISH" : "BULLISH";
  if (!emaBullish && priceBelowFast && !structureBullish) return weakTrend ? "WEAK_BEARISH" : "BEARISH";
  return "NEUTRAL";
}

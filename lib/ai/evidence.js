export function buildEvidence({ technical, screener }) {
  const bullish = [];
  const bearish = [];

  const { price, indicators, structure, breakout, trend } = technical;

  if (price !== null && indicators.ema[20] !== null) {
    if (price > indicators.ema[20]) bullish.push("Price above EMA20");
    else bearish.push("Price below EMA20");
  }

  if (indicators.ema[20] !== null && indicators.ema[50] !== null) {
    if (indicators.ema[20] > indicators.ema[50]) bullish.push("EMA20 above EMA50");
    else bearish.push("EMA20 below EMA50");
  }

  if (structure.higherHigh && structure.higherLow) bullish.push("Higher High / Higher Low structure");
  if (structure.lowerHigh && structure.lowerLow) bearish.push("Lower High / Lower Low structure");

  if (indicators.macd.state === "BULLISH_MOMENTUM") bullish.push("MACD momentum positive");
  if (indicators.macd.state === "BEARISH_MOMENTUM") bearish.push("MACD momentum negative");

  if (indicators.rsiLabel === "STRONG") bullish.push("RSI healthy");
  if (indicators.rsiLabel === "WEAK") bearish.push("RSI weak");
  if (indicators.rsiLabel === "OVERSOLD") bearish.push("RSI oversold");

  if (indicators.volume.volumeTrend === "INCREASING" && (indicators.volume.volumeRatio ?? 0) > 1) {
    bullish.push("Volume confirmation (increasing)");
  }

  if (breakout.status === "BREAKOUT" || breakout.status === "ABOVE_RESISTANCE") bullish.push("Breakout above resistance confirmed");
  if (breakout.status === "FAILED_BREAKOUT") bearish.push("Failed breakout detected");

  if (trend.longTerm === "BULLISH" || trend.longTerm === "WEAK_BULLISH") bullish.push("Higher timeframe trend bullish");
  if (trend.longTerm === "BEARISH" || trend.longTerm === "WEAK_BEARISH") bearish.push("Higher timeframe trend bearish");

  if (screener?.momentumLabel === "STRONG_UP") bullish.push("Screener momentum strong");
  if (screener?.exhaustion?.status === "POSSIBLE_EXHAUSTION") bearish.push("Screener flags possible exhaustion");

  return { bullishEvidence: bullish, bearishEvidence: bearish };
}

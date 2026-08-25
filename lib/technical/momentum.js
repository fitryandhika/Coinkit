export function classifyRSI(rsiValue) {
  if (rsiValue === null || rsiValue === undefined) return "UNKNOWN";
  if (rsiValue < 30) return "OVERSOLD";
  if (rsiValue < 45) return "WEAK";
  if (rsiValue <= 55) return "NEUTRAL";
  if (rsiValue <= 70) return "STRONG";
  return "OVERBOUGHT";
}

export function classifyMACD({ macdValue, signalValue, histogram, prevHistogram }) {
  if (macdValue === null || signalValue === null) {
    return { state: "UNKNOWN", histogramTrend: "UNKNOWN" };
  }

  const state = macdValue > signalValue ? "BULLISH_MOMENTUM" : macdValue < signalValue ? "BEARISH_MOMENTUM" : "NEUTRAL";

  let histogramTrend = "UNKNOWN";
  if (histogram !== null && prevHistogram !== null) {
    histogramTrend = histogram > prevHistogram ? "INCREASING" : histogram < prevHistogram ? "DECREASING" : "FLAT";
  }

  return { state, histogramTrend };
}

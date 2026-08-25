function findPivots(candles, radius = 2) {
  const highs = [];
  const lows = [];

  for (let i = radius; i < candles.length - radius; i += 1) {
    const window = candles.slice(i - radius, i + radius + 1);
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;

    if (window.every((c) => c.high <= currentHigh)) highs.push({ index: i, price: currentHigh });
    if (window.every((c) => c.low >= currentLow)) lows.push({ index: i, price: currentLow });
  }

  return { highs, lows };
}

export function analyzeStructure(candles) {
  const empty = {
    marketStructure: "UNCLEAR",
    higherHigh: null,
    higherLow: null,
    lowerHigh: null,
    lowerLow: null,
    pivotHighs: [],
    pivotLows: [],
  };
  if (!candles || candles.length < 10) return empty;

  const { highs, lows } = findPivots(candles, 2);
  const lastTwoHighs = highs.slice(-2);
  const lastTwoLows = lows.slice(-2);

  const higherHigh = lastTwoHighs.length === 2 ? lastTwoHighs[1].price > lastTwoHighs[0].price : null;
  const lowerHigh = lastTwoHighs.length === 2 ? lastTwoHighs[1].price < lastTwoHighs[0].price : null;
  const higherLow = lastTwoLows.length === 2 ? lastTwoLows[1].price > lastTwoLows[0].price : null;
  const lowerLow = lastTwoLows.length === 2 ? lastTwoLows[1].price < lastTwoLows[0].price : null;

  let marketStructure = "UNCLEAR";
  if (higherHigh && higherLow) marketStructure = "BULLISH_STRUCTURE";
  else if (lowerHigh && lowerLow) marketStructure = "BEARISH_STRUCTURE";
  else if (higherHigh !== null && higherLow !== null) marketStructure = "RANGE";

  return {
    marketStructure,
    higherHigh,
    higherLow,
    lowerHigh,
    lowerLow,
    pivotHighs: lastTwoHighs.map((p) => p.price),
    pivotLows: lastTwoLows.map((p) => p.price),
  };
}

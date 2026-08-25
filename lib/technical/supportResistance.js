export function detectSupportResistance(candles, { maxLevels = 3, radius = 2 } = {}) {
  if (!candles || candles.length < radius * 2 + 3) return { support: [], resistance: [] };

  const highs = [];
  const lows = [];

  for (let i = radius; i < candles.length - radius; i += 1) {
    const window = candles.slice(i - radius, i + radius + 1);
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;
    if (window.every((c) => c.high <= currentHigh)) highs.push(currentHigh);
    if (window.every((c) => c.low >= currentLow)) lows.push(currentLow);
  }

  const lastClose = candles[candles.length - 1].close;

  const resistance = [...new Set(highs)]
    .filter((price) => lastClose === null || price >= lastClose)
    .sort((a, b) => a - b)
    .slice(0, maxLevels);

  const support = [...new Set(lows)]
    .filter((price) => lastClose === null || price <= lastClose)
    .sort((a, b) => b - a)
    .slice(0, maxLevels);

  return { support, resistance };
}

export function sma(values, period) {
  const result = new Array(values.length).fill(null);
  if (values.length < period) return result;

  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

export function ema(values, period) {
  const result = new Array(values.length).fill(null);
  if (values.length < period) return result;

  const k = 2 / (period + 1);
  let prevEma = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result[period - 1] = prevEma;

  for (let i = period; i < values.length; i += 1) {
    const value = values[i] * k + prevEma * (1 - k);
    result[i] = value;
    prevEma = value;
  }
  return result;
}

export function rsi(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function macd(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);
  const macdLine = closes.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null ? fastEma[i] - slowEma[i] : null
  );

  const firstValidIdx = macdLine.findIndex((v) => v !== null);
  const signalLine = new Array(closes.length).fill(null);
  if (firstValidIdx !== -1) {
    const macdValues = macdLine.slice(firstValidIdx);
    const signalEma = ema(macdValues, signalPeriod);
    signalEma.forEach((v, idx) => {
      signalLine[firstValidIdx + idx] = v;
    });
  }

  const histogram = closes.map((_, i) =>
    macdLine[i] !== null && signalLine[i] !== null ? macdLine[i] - signalLine[i] : null
  );

  return { macdLine, signalLine, histogram };
}

export function atr(candles, period = 14) {
  const result = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return result;

  const trueRanges = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  let avg = trueRanges.slice(1, period + 1).reduce((s, v) => s + v, 0) / period;
  result[period] = avg;
  for (let i = period + 1; i < candles.length; i += 1) {
    avg = (avg * (period - 1) + trueRanges[i]) / period;
    result[i] = avg;
  }
  return result;
}

export function bollinger(closes, period = 20, stdDevMultiplier = 2) {
  const middle = sma(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i += 1) {
    if (middle[i] === null) continue;
    const window = closes.slice(i - period + 1, i + 1);
    const variance = window.reduce((s, v) => s + (v - middle[i]) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    upper[i] = middle[i] + stdDevMultiplier * stdDev;
    lower[i] = middle[i] - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}

export function adx(candles, period = 14) {
  const len = candles.length;
  const result = new Array(len).fill(null);
  if (len < period * 2) return result;

  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);
  const tr = new Array(len).fill(0);

  for (let i = 1; i < len; i += 1) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    const prevClose = candles[i - 1].close;
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
  }

  let smoothTR = tr.slice(1, period + 1).reduce((s, v) => s + v, 0);
  let smoothPlusDM = plusDM.slice(1, period + 1).reduce((s, v) => s + v, 0);
  let smoothMinusDM = minusDM.slice(1, period + 1).reduce((s, v) => s + v, 0);

  const dxValues = new Array(len).fill(null);
  for (let i = period + 1; i < len; i += 1) {
    smoothTR = smoothTR - smoothTR / period + tr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];

    const plusDI = smoothTR ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    dxValues[i] = diSum ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
  }

  const firstDxIdx = dxValues.findIndex((v) => v !== null);
  if (firstDxIdx === -1 || len - firstDxIdx < period) return result;

  let adxValue = dxValues.slice(firstDxIdx, firstDxIdx + period).reduce((s, v) => s + v, 0) / period;
  result[firstDxIdx + period - 1] = adxValue;

  for (let i = firstDxIdx + period; i < len; i += 1) {
    adxValue = (adxValue * (period - 1) + dxValues[i]) / period;
    result[i] = adxValue;
  }

  return result;
}

export function vwap(candles) {
  const result = new Array(candles.length).fill(null);
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  candles.forEach((c, i) => {
    if (c.high === null || c.low === null || c.close === null || c.volume === null) {
      result[i] = i > 0 ? result[i - 1] : null;
      return;
    }
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativePV += typicalPrice * c.volume;
    cumulativeVolume += c.volume;
    result[i] = cumulativeVolume ? cumulativePV / cumulativeVolume : null;
  });

  return result;
}

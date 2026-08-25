export function computeBreakout(candles, config) {
  if (!candles || candles.length < 3) {
    return { status: "UNKNOWN", breakoutScore: null, previousHigh: null, proximityPct: null };
  }

  const priorCandles = candles.slice(0, -1);
  const highs = priorCandles.map((c) => c.high).filter((h) => h !== null);
  const previousHigh = highs.length ? Math.max(...highs) : null;
  const current = candles[candles.length - 1];

  if (!Number.isFinite(previousHigh) || current.close === null) {
    return { status: "UNKNOWN", breakoutScore: null, previousHigh: null, proximityPct: null };
  }

  const proximityPct = ((current.close - previousHigh) / previousHigh) * 100;
  const priorVolumes = priorCandles.map((c) => c.volume).filter((v) => v !== null);
  const avgVolume = priorVolumes.length ? priorVolumes.reduce((s, v) => s + v, 0) / priorVolumes.length : null;
  const volumeRatio = current.volume !== null && avgVolume ? current.volume / avgVolume : null;

  let status = "NORMAL";
  if (proximityPct >= 0) {
    status = volumeRatio !== null && volumeRatio < config.BREAKOUT_MIN_VOLUME_RATIO ? "WEAK_BREAKOUT" : "BREAKOUT";
  } else if (proximityPct >= -config.BREAKOUT_PROXIMITY_PCT) {
    status = "BREAKOUT_PROXIMITY";
  }

  const breakoutScoreMap = { BREAKOUT: 100, WEAK_BREAKOUT: 60, BREAKOUT_PROXIMITY: 75, NORMAL: 40 };

  return {
    status,
    proximityPct: Number(proximityPct.toFixed(4)),
    previousHigh: Number(previousHigh.toFixed(8)),
    breakoutScore: breakoutScoreMap[status] ?? null,
  };
}

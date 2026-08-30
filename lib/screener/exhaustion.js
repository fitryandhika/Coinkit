export function computeExhaustion(candles, momentum, volumeRatio, volatility, config) {
  if (!candles || candles.length < 6) return { status: "UNKNOWN", flags: [], deviationPct: null };

  // Deviasi dihitung terhadap rata-rata jendela pendek (EXHAUSTION_LOOKBACK).
  // Kalau memakai seluruh 150 candle, harga dalam tren sehat akan terus-menerus
  // "jauh dari rata-rata" dan penalti exhaustion menyala tanpa alasan.
  const lookback = config?.EXHAUSTION_LOOKBACK ?? 20;
  const closes = candles.slice(-lookback).map((c) => c.close).filter((v) => Number.isFinite(v));
  if (closes.length === 0) return { status: "UNKNOWN", flags: [], deviationPct: null };

  const avgClose = closes.reduce((s, v) => s + v, 0) / closes.length;
  const lastClose = closes[closes.length - 1];
  const deviationPct = avgClose ? ((lastClose - avgClose) / avgClose) * 100 : null;

  const flags = [];
  if (Number.isFinite(momentum?.m1) && Math.abs(momentum.m1) >= config.EXHAUSTION_MOMENTUM_PCT) {
    flags.push("rapid_price_move");
  }
  if (Number.isFinite(volumeRatio) && volumeRatio >= config.EXHAUSTION_VOLUME_RATIO) {
    flags.push("volume_spike");
  }
  if (deviationPct !== null && Math.abs(deviationPct) >= config.EXHAUSTION_DEVIATION_PCT) {
    flags.push("far_from_average");
  }
  if (Number.isFinite(volatility?.volatilityPct) && volatility.volatilityPct >= config.EXHAUSTION_VOLATILITY_PCT) {
    flags.push("range_expansion");
  }

  return {
    status: flags.length >= config.EXHAUSTION_MIN_FLAGS ? "POSSIBLE_EXHAUSTION" : "NORMAL",
    flags,
    deviationPct: deviationPct === null ? null : Number(deviationPct.toFixed(4)),
  };
}

export function computeExhaustion(candles, momentum, volumeRatio, volatility, config) {
  if (!candles || candles.length < 6) return { status: "UNKNOWN", flags: [] };

  const closes = candles.map((c) => c.close).filter((v) => v !== null);
  if (closes.length === 0) return { status: "UNKNOWN", flags: [] };

  const avgClose = closes.reduce((s, v) => s + v, 0) / closes.length;
  const lastClose = closes[closes.length - 1];
  const deviationPct = avgClose ? ((lastClose - avgClose) / avgClose) * 100 : null;

  const flags = [];
  if (momentum.m1 !== null && Math.abs(momentum.m1) >= config.EXHAUSTION_MOMENTUM_PCT) flags.push("rapid_price_move");
  if (volumeRatio !== null && volumeRatio >= config.EXHAUSTION_VOLUME_RATIO) flags.push("volume_spike");
  if (deviationPct !== null && Math.abs(deviationPct) >= config.EXHAUSTION_DEVIATION_PCT) flags.push("far_from_average");
  if (volatility?.volatilityPct !== null && volatility?.volatilityPct >= config.EXHAUSTION_VOLATILITY_PCT) {
    flags.push("range_expansion");
  }

  return {
    status: flags.length >= config.EXHAUSTION_MIN_FLAGS ? "POSSIBLE_EXHAUSTION" : "NORMAL",
    flags,
  };
}

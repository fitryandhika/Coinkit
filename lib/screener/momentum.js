function toPercent(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(4));
}

export function computeMomentum(candles) {
  if (!candles || candles.length < 2) {
    return { m1: null, m3: null, m6: null, m12: null };
  }
  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1];

  const at = (periodsAgo) => {
    const idx = closes.length - 1 - periodsAgo;
    return idx >= 0 ? closes[idx] : null;
  };

  return {
    m1: toPercent(last, at(1)),
    m3: toPercent(last, at(3)),
    m6: toPercent(last, at(6)),
    m12: toPercent(last, at(12)),
  };
}

export function describeMomentum(m1, config) {
  if (m1 === null || m1 === undefined) return "UNKNOWN";
  const abs = Math.abs(m1);
  if (abs >= config.MOMENTUM_STRONG_PCT) return m1 > 0 ? "STRONG_UP" : "STRONG_DOWN";
  if (abs >= config.MOMENTUM_MODERATE_PCT) return m1 > 0 ? "MODERATE_UP" : "MODERATE_DOWN";
  return "FLAT";
}

export function computeMomentumScore(momentum, config) {
  const primary = momentum.m1 ?? momentum.m3 ?? momentum.m6 ?? momentum.m12;
  if (primary === null || primary === undefined) return null;
  const clamp = config.MOMENTUM_CLAMP_PCT;
  const bounded = Math.max(-clamp, Math.min(clamp, primary));
  return Number((((bounded + clamp) / (2 * clamp)) * 100).toFixed(2));
}

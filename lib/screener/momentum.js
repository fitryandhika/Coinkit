const DEFAULT_BLEND = { m1: 0.45, m3: 0.35, m6: 0.2 };

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

/**
 * Arah & kekuatan momentum TIDAK boleh ditentukan satu candle tunggal (versi
 * lama memakai m1 saja = sangat berisik). Di sini m1/m3/m6 dinormalisasi jadi
 * "% per candle" lalu di-blend, plus dicatat apakah ketiganya kompak searah.
 */
export function computeMomentumRate(momentum, config) {
  const weights = config?.MOMENTUM_BLEND_WEIGHTS || DEFAULT_BLEND;

  const parts = [
    { value: momentum?.m1, periods: 1, weight: weights.m1 ?? 0 },
    { value: momentum?.m3, periods: 3, weight: weights.m3 ?? 0 },
    { value: momentum?.m6, periods: 6, weight: weights.m6 ?? 0 },
  ].filter((p) => Number.isFinite(p.value) && p.weight > 0);

  if (parts.length === 0) return { rate: null, aligned: false, alignedDirection: "MIXED" };

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const rate = parts.reduce((s, p) => s + (p.value / p.periods) * p.weight, 0) / totalWeight;

  const signs = parts.map((p) => Math.sign(p.value)).filter((s) => s !== 0);
  const allUp = signs.length > 0 && signs.every((s) => s > 0);
  const allDown = signs.length > 0 && signs.every((s) => s < 0);

  return {
    rate: Number(rate.toFixed(4)),
    aligned: allUp || allDown,
    alignedDirection: allUp ? "UP" : allDown ? "DOWN" : "MIXED",
  };
}

/** Label deskriptif dari rate per-candle (dipakai UI, reasons, dan konteks BTC). */
export function describeMomentum(rate, config) {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return "UNKNOWN";
  const abs = Math.abs(rate);
  if (abs >= config.MOMENTUM_STRONG_PCT) return rate > 0 ? "STRONG_UP" : "STRONG_DOWN";
  if (abs >= config.MOMENTUM_MODERATE_PCT) return rate > 0 ? "MODERATE_UP" : "MODERATE_DOWN";
  return "FLAT";
}

/**
 * INI PERBAIKAN INTINYA.
 *
 * Versi lama memetakan -5% -> 0 dan +5% -> 100, jadi coin yang jatuh keras
 * (setup SHORT terbaik) selalu dapat skor rendah dan tidak pernah lolos
 * ambang auto-record (>= 60). Sekarang skor dihitung RELATIF terhadap arah
 * setup: momentum kuat SEARAH -> 100, datar -> 50, kuat MELAWAN -> 0.
 * Dengan begitu SHORT dan LONG dinilai dengan penggaris yang sama.
 */
export function computeDirectionalMomentumScore(momentumRate, direction, config) {
  if (!momentumRate || momentumRate.rate === null || momentumRate.rate === undefined) return null;

  // Arah belum jelas: tidak ada sisi yang bisa dinilai, beri nilai netral.
  if (direction !== "BULLISH" && direction !== "BEARISH") return 50;

  const signed = direction === "BULLISH" ? momentumRate.rate : -momentumRate.rate;
  const clamp = config.MOMENTUM_CLAMP_PCT;
  const bounded = Math.max(-clamp, Math.min(clamp, signed));

  let score = 50 + (bounded / clamp) * 50;

  if (momentumRate.aligned) {
    const bonus = config.MOMENTUM_ALIGNMENT_BONUS ?? 0;
    const alignedWithSetup =
      (direction === "BULLISH" && momentumRate.alignedDirection === "UP") ||
      (direction === "BEARISH" && momentumRate.alignedDirection === "DOWN");
    score += alignedWithSetup ? bonus : -bonus;
  }

  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

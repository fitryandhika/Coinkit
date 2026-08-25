/**
 * Trail multiplier ditentukan SEKALI di saat prediction dicatat (pakai kondisi BTC
 * SAAT ITU) — bukan dihitung ulang saat worker mengevaluasi nanti. Ini menjaga
 * prinsip no-look-ahead: aturan dikunci di T0, evaluasi cuma pakai data T > T0.
 */
export function resolveTrailMultiplier({ direction, btcCorrelation, btcMomentumLabel, config }) {
  if (btcCorrelation === null || btcCorrelation === undefined) return config.DEFAULT_TRAIL_MULTIPLIER;

  const btcAligned = direction === "BULLISH"
    ? ["STRONG_UP", "MODERATE_UP"].includes(btcMomentumLabel)
    : ["STRONG_DOWN", "MODERATE_DOWN"].includes(btcMomentumLabel);
  const highCorr = Math.abs(btcCorrelation) >= config.HIGH_CORRELATION_THRESHOLD;

  if (highCorr && btcAligned) return config.WIDE_TRAIL_MULTIPLIER; // BTC mendukung arah -> beri ruang profit lanjut
  if (!btcAligned) return config.TIGHT_TRAIL_MULTIPLIER; // BTC melawan arah -> lebih hati-hati kunci profit
  return config.DEFAULT_TRAIL_MULTIPLIER;
}

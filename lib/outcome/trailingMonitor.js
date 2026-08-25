import { OUTCOME_CONFIG } from "./config";

/**
 * Simulasi trailing stop candle-demi-candle. Dipakai HANYA untuk prediction yang
 * punya trailAtr (dibuat setelah fitur trailing SL ditambahkan). Prediction lama
 * (trailAtr null) tetap pakai evaluateOutcome() di monitor.js — perilaku SL tetap,
 * tidak diubah sama sekali.
 *
 * Mekanisme:
 * 1. SL awal tetap sampai profit mengambang capai BREAKEVEN_TRIGGER_R.
 * 2. Begitu tercapai, SL pindah ke harga entry (breakeven — tidak mungkin rugi lagi).
 * 3. Setelah breakeven aktif, SL terus mengikuti titik ekstrem (high untuk LONG,
 *    low untuk SHORT) dikurangi jarak trailAtr x trailMultiplier — SL cuma boleh
 *    bergerak ke arah yang menguntungkan, tidak pernah mundur.
 * 4. TP1/TP2/TP3 jadi PENANDA REFERENSI (dicatat kapan tersentuh) — bukan lagi
 *    titik keluar paksa. Exit sesungguhnya selalu lewat SL/breakeven/trailing.
 */
export function evaluateTrailingOutcome({
  direction,
  entry,
  stopLoss,
  tp1,
  tp2,
  tp3,
  trailAtr,
  trailMultiplier,
  candles,
  config = OUTCOME_CONFIG,
}) {
  const empty = {
    maximumGainPct: null, maximumDrawdownPct: null, maximumGainPrice: null, maximumDrawdownPrice: null, maximumR: null,
    tp1Hit: false, tp2Hit: false, tp3Hit: false, slHit: false,
    tp1HitAt: null, tp2HitAt: null, tp3HitAt: null, slHitAt: null,
    outcome: "PENDING", exitPrice: null, breakevenActivated: false, finalStopPrice: stopLoss,
  };
  if (!candles || candles.length === 0 || entry === null || stopLoss === null) return empty;

  const isLong = direction === "LONG" || direction === "BUY";
  const riskDistance = Math.abs(entry - stopLoss);
  if (riskDistance <= 0) return empty;

  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  let tp1HitAt = null;
  let tp2HitAt = null;
  let tp3HitAt = null;
  let currentStop = stopLoss;
  let breakevenActivated = false;
  let extremeSinceEntry = entry;
  let outcome = "PENDING";
  let exitPrice = null;
  let slHitAt = null;

  for (const candle of candles) {
    if (candle.high !== null && candle.high > highestHigh) highestHigh = candle.high;
    if (candle.low !== null && candle.low < lowestLow) lowestLow = candle.low;

    const stopTouched = isLong
      ? candle.low !== null && candle.low <= currentStop
      : candle.high !== null && candle.high >= currentStop;

    if (stopTouched) {
      outcome = breakevenActivated ? "TRAILING_STOP_HIT" : "SL_HIT";
      exitPrice = currentStop;
      slHitAt = candle.time;
      break; // trade selesai — candle setelahnya tidak diproses
    }

    if (isLong) {
      if (!tp1HitAt && tp1 !== null && candle.high !== null && candle.high >= tp1) tp1HitAt = candle.time;
      if (!tp2HitAt && tp2 !== null && candle.high !== null && candle.high >= tp2) tp2HitAt = candle.time;
      if (!tp3HitAt && tp3 !== null && candle.high !== null && candle.high >= tp3) tp3HitAt = candle.time;
    } else {
      if (!tp1HitAt && tp1 !== null && candle.low !== null && candle.low <= tp1) tp1HitAt = candle.time;
      if (!tp2HitAt && tp2 !== null && candle.low !== null && candle.low <= tp2) tp2HitAt = candle.time;
      if (!tp3HitAt && tp3 !== null && candle.low !== null && candle.low <= tp3) tp3HitAt = candle.time;
    }

    const candleExtreme = isLong ? candle.high : candle.low;
    if (candleExtreme !== null) {
      extremeSinceEntry = isLong ? Math.max(extremeSinceEntry, candleExtreme) : Math.min(extremeSinceEntry, candleExtreme);
    }

    const profitR = isLong
      ? (extremeSinceEntry - entry) / riskDistance
      : (entry - extremeSinceEntry) / riskDistance;

    if (!breakevenActivated && profitR >= config.BREAKEVEN_TRIGGER_R) {
      breakevenActivated = true;
      currentStop = entry;
    }

    if (breakevenActivated && trailAtr) {
      const trailDistance = trailAtr * (trailMultiplier ?? 2);
      const candidateStop = isLong ? extremeSinceEntry - trailDistance : extremeSinceEntry + trailDistance;
      currentStop = isLong ? Math.max(currentStop, candidateStop) : Math.min(currentStop, candidateStop);
    }
  }

  if (highestHigh === -Infinity || lowestLow === Infinity) return empty;

  const maximumGainPct = isLong
    ? Number((((highestHigh - entry) / entry) * 100).toFixed(4))
    : Number((((entry - lowestLow) / entry) * 100).toFixed(4));
  const maximumDrawdownPct = isLong
    ? Number((((lowestLow - entry) / entry) * 100).toFixed(4))
    : Number((((entry - highestHigh) / entry) * 100).toFixed(4));
  const maximumGainPrice = isLong ? highestHigh : lowestLow;
  const maximumDrawdownPrice = isLong ? lowestLow : highestHigh;
  const maximumR = Number(((Math.abs(maximumGainPct / 100) * entry) / riskDistance).toFixed(4));

  return {
    maximumGainPct, maximumDrawdownPct, maximumGainPrice, maximumDrawdownPrice, maximumR,
    tp1Hit: Boolean(tp1HitAt), tp2Hit: Boolean(tp2HitAt), tp3Hit: Boolean(tp3HitAt),
    slHit: outcome !== "PENDING",
    tp1HitAt, tp2HitAt, tp3HitAt, slHitAt,
    outcome, exitPrice, breakevenActivated, finalStopPrice: currentStop,
  };
}

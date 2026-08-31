import { OUTCOME_CONFIG } from "./config.js";

/**
 * Mesin penentu HASIL sebuah setup dari deretan candle.
 *
 * File ini sengaja murni (tanpa akses jaringan/database) supaya bisa diuji
 * langsung dengan `npm test`.
 *
 * Dua aturan yang dulu salah dan sekarang diperbaiki:
 *
 * 1. FIRST TOUCH. Versi lama memakai rantai else-if:
 *      if (slHit && (tp1 belum kena || sl lebih dulu)) -> SL
 *      else if (tp3Hit) -> TP3 ...
 *    Akibatnya setup yang menyentuh TP1 lalu kena SL, tapi BERJAM-JAM setelah
 *    SL sempat menyentuh TP3, tercatat sebagai TP3_HIT. Sekarang candle ditelusuri
 *    berurutan dan trade BERHENTI di sentuhan pertama.
 *
 * 2. SATU CANDLE MENYENTUH SL DAN TP SEKALIGUS. Urutannya mustahil diketahui
 *    dari data candle (butuh data tick). Asumsi konservatif: SL duluan. Tanpa ini
 *    hasil evaluasi selalu lebih bagus daripada kenyataan.
 *
 * Selain itu MFE/MAE kini hanya dihitung SAMPAI titik keluar — bukan sampai
 * candle terakhir yang kebetulan terambil.
 */

const TP_KEYS = ["tp1", "tp2", "tp3"];

function isLongDecision(direction) {
  return direction === "LONG" || direction === "BUY";
}

/**
 * Granularitas dipilih dari PANJANG HORIZON, bukan dari sudah berapa lama setup
 * berjalan. Versi lama memakai waktu berjalan, jadi setup yang telat diperiksa
 * tiba-tiba dinilai memakai candle 4 jam — resolusi SL/TP-nya jadi kasar sekali.
 */
export function granularityForHorizon(horizonHours) {
  if (horizonHours <= 4) return "5m";
  if (horizonHours <= 24) return "15m";
  if (horizonHours <= 72) return "1h";
  return "4h";
}

export const GRANULARITY_MS = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

/** Daftar TP yang valid (ada nilainya DAN berada di sisi yang benar), diurutkan
 * dari yang paling dekat ke entry. TP terdekat itulah titik keluar. */
function usableTakeProfits({ direction, entry, tp1, tp2, tp3 }) {
  const isLong = isLongDecision(direction);
  const raw = { tp1, tp2, tp3 };
  return TP_KEYS.map((key) => ({ key, price: raw[key] }))
    .filter((t) => Number.isFinite(t.price) && (isLong ? t.price > entry : t.price < entry))
    .sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry));
}

function emptyResult(stopLoss = null) {
  return {
    maximumGainPct: null, maximumDrawdownPct: null,
    maximumGainPrice: null, maximumDrawdownPrice: null, maximumR: null,
    tp1Hit: false, tp2Hit: false, tp3Hit: false, slHit: false,
    tp1HitAt: null, tp2HitAt: null, tp3HitAt: null, slHitAt: null,
    outcome: "PENDING", exitPrice: null, exitReason: null, exitAt: null,
    breakevenActivated: false, finalStopPrice: stopLoss,
    candlesUsed: 0, windowLastClose: null,
  };
}

/**
 * Menyusun angka MFE/MAE dari titik ekstrem yang sudah dikumpulkan sampai exit.
 */
function summarize({ isLong, entry, riskDistance, highestHigh, lowestLow }) {
  const maximumGainPct = isLong
    ? ((highestHigh - entry) / entry) * 100
    : ((entry - lowestLow) / entry) * 100;
  const maximumDrawdownPct = isLong
    ? ((lowestLow - entry) / entry) * 100
    : ((entry - highestHigh) / entry) * 100;

  return {
    maximumGainPct: Number(maximumGainPct.toFixed(4)),
    maximumDrawdownPct: Number(maximumDrawdownPct.toFixed(4)),
    maximumGainPrice: isLong ? highestHigh : lowestLow,
    maximumDrawdownPrice: isLong ? lowestLow : highestHigh,
    maximumR: riskDistance
      ? Number(((Math.abs(maximumGainPct / 100) * entry) / riskDistance).toFixed(4))
      : null,
  };
}

/**
 * Evaluasi SL/TP tetap (dipakai prediction lama yang tidak punya trail_atr).
 * Titik keluar = TP TERDEKAT atau SL, mana yang tersentuh lebih dulu.
 */
export function evaluateOutcome({
  direction, entry, stopLoss, tp1, tp2, tp3, candles, config = OUTCOME_CONFIG,
}) {
  if (!candles || candles.length === 0 || !Number.isFinite(entry)) return emptyResult(stopLoss);

  const isLong = isLongDecision(direction);
  const hasStop = Number.isFinite(stopLoss);
  const riskDistance = hasStop ? Math.abs(entry - stopLoss) : null;
  const targets = usableTakeProfits({ direction, entry, tp1, tp2, tp3 });
  const exitTarget = targets[0] ?? null;

  // Ekstrem dimulai dari harga entry, bukan -Infinity. Dengan begitu MFE tidak
  // pernah negatif dan MAE tidak pernah positif (definisi baku excursion), dan
  // setup yang kena SL di candle PERTAMA tetap menghasilkan angka yang valid.
  let highestHigh = entry;
  let lowestLow = entry;
  const hitAt = { tp1: null, tp2: null, tp3: null };
  let slHitAt = null;
  let outcome = "PENDING";
  let exitPrice = null;
  let exitReason = null;
  let exitAt = null;
  let candlesUsed = 0;

  for (const candle of candles) {
    candlesUsed += 1;
    const high = Number.isFinite(candle.high) ? candle.high : null;
    const low = Number.isFinite(candle.low) ? candle.low : null;

    const stopTouched = hasStop && (isLong ? low !== null && low <= stopLoss : high !== null && high >= stopLoss);
    const targetTouched = exitTarget
      ? (isLong ? high !== null && high >= exitTarget.price : low !== null && low <= exitTarget.price)
      : false;

    // Penanda referensi TP2/TP3 tetap dicatat (berguna melihat seberapa jauh
    // harga sempat berjalan), tapi TIDAK menentukan titik keluar.
    for (const t of targets) {
      if (hitAt[t.key]) continue;
      const touched = isLong ? high !== null && high >= t.price : low !== null && low <= t.price;
      if (touched) hitAt[t.key] = candle.time;
    }

    if (stopTouched || targetTouched) {
      const stopWins = stopTouched && (!targetTouched || config.SAME_CANDLE_ASSUME_STOP_FIRST);

      // Di candle penutup, sisi yang menguntungkan TIDAK ikut dihitung sebagai
      // MFE — kalau tidak, setup yang kena SL tetap terlihat "sempat untung".
      if (stopWins) {
        if (isLong && low !== null) lowestLow = Math.min(lowestLow, low);
        if (!isLong && high !== null) highestHigh = Math.max(highestHigh, high);
        slHitAt = candle.time;
        outcome = "SL_HIT";
        exitPrice = stopLoss;
        exitReason = "STOP_LEVEL";
      } else {
        if (high !== null) highestHigh = Math.max(highestHigh, high);
        if (low !== null) lowestLow = Math.min(lowestLow, low);
        outcome = `${exitTarget.key.toUpperCase()}_HIT`;
        exitPrice = exitTarget.price;
        exitReason = "TP_LEVEL";
      }
      exitAt = candle.time;
      break;
    }

    if (high !== null) highestHigh = Math.max(highestHigh, high);
    if (low !== null) lowestLow = Math.min(lowestLow, low);
  }

  const windowLastClose = Number.isFinite(candles[candles.length - 1]?.close)
    ? candles[candles.length - 1].close
    : null;

  return {
    ...summarize({ isLong, entry, riskDistance, highestHigh, lowestLow }),
    tp1Hit: Boolean(hitAt.tp1), tp2Hit: Boolean(hitAt.tp2), tp3Hit: Boolean(hitAt.tp3),
    slHit: Boolean(slHitAt),
    tp1HitAt: hitAt.tp1, tp2HitAt: hitAt.tp2, tp3HitAt: hitAt.tp3, slHitAt,
    outcome, exitPrice, exitReason, exitAt,
    breakevenActivated: false,
    finalStopPrice: hasStop ? stopLoss : null,
    candlesUsed, windowLastClose,
  };
}

/**
 * Trailing stop candle-demi-candle, untuk prediction yang punya trailAtr.
 *
 * 1. SL awal tetap sampai profit mengambang capai BREAKEVEN_TRIGGER_R.
 * 2. Setelah itu SL pindah ke harga entry (breakeven).
 * 3. Lalu SL mengikuti titik ekstrem dikurangi trailAtr x trailMultiplier, dan
 *    HANYA boleh bergerak ke arah yang menguntungkan.
 * 4. TP1/TP2/TP3 jadi penanda referensi — exit selalu lewat SL/breakeven/trailing.
 *
 * Perbaikan dibanding versi lama: stop diperiksa memakai stop dari candle
 * SEBELUMNYA (trailing baru boleh naik setelah candle itu selamat), MFE tidak
 * lagi menghitung sisi menguntungkan di candle yang menutup posisi, dan alasan
 * keluar dicatat eksplisit.
 */
export function evaluateTrailingOutcome({
  direction, entry, stopLoss, tp1, tp2, tp3,
  trailAtr, trailMultiplier, candles, config = OUTCOME_CONFIG,
}) {
  if (!candles || candles.length === 0 || !Number.isFinite(entry) || !Number.isFinite(stopLoss)) {
    return emptyResult(stopLoss);
  }

  const isLong = isLongDecision(direction);
  const riskDistance = Math.abs(entry - stopLoss);
  if (riskDistance <= 0) return emptyResult(stopLoss);

  const targets = usableTakeProfits({ direction, entry, tp1, tp2, tp3 });

  let highestHigh = entry;
  let lowestLow = entry;
  const hitAt = { tp1: null, tp2: null, tp3: null };
  let currentStop = stopLoss;
  let breakevenActivated = false;
  let extremeSinceEntry = entry;
  let outcome = "PENDING";
  let exitPrice = null;
  let exitReason = null;
  let exitAt = null;
  let slHitAt = null;
  let candlesUsed = 0;

  for (const candle of candles) {
    candlesUsed += 1;
    const high = Number.isFinite(candle.high) ? candle.high : null;
    const low = Number.isFinite(candle.low) ? candle.low : null;

    const stopTouched = isLong ? low !== null && low <= currentStop : high !== null && high >= currentStop;

    if (stopTouched) {
      if (isLong && low !== null) lowestLow = Math.min(lowestLow, low);
      if (!isLong && high !== null) highestHigh = Math.max(highestHigh, high);
      outcome = breakevenActivated ? "TRAILING_STOP_HIT" : "SL_HIT";
      exitPrice = currentStop;
      exitReason = breakevenActivated ? "TRAILING_STOP" : "STOP_LEVEL";
      slHitAt = candle.time;
      exitAt = candle.time;
      break;
    }

    if (high !== null) highestHigh = Math.max(highestHigh, high);
    if (low !== null) lowestLow = Math.min(lowestLow, low);

    for (const t of targets) {
      if (hitAt[t.key]) continue;
      const touched = isLong ? high !== null && high >= t.price : low !== null && low <= t.price;
      if (touched) hitAt[t.key] = candle.time;
    }

    const candleExtreme = isLong ? high : low;
    if (candleExtreme !== null) {
      extremeSinceEntry = isLong
        ? Math.max(extremeSinceEntry, candleExtreme)
        : Math.min(extremeSinceEntry, candleExtreme);
    }

    const profitR = isLong
      ? (extremeSinceEntry - entry) / riskDistance
      : (entry - extremeSinceEntry) / riskDistance;

    if (!breakevenActivated && profitR >= config.BREAKEVEN_TRIGGER_R) {
      breakevenActivated = true;
      currentStop = entry;
    }

    if (breakevenActivated && Number.isFinite(trailAtr) && trailAtr > 0) {
      const trailDistance = trailAtr * (Number.isFinite(trailMultiplier) ? trailMultiplier : 2);
      const candidateStop = isLong ? extremeSinceEntry - trailDistance : extremeSinceEntry + trailDistance;
      currentStop = isLong ? Math.max(currentStop, candidateStop) : Math.min(currentStop, candidateStop);
    }
  }

  const windowLastClose = Number.isFinite(candles[candles.length - 1]?.close)
    ? candles[candles.length - 1].close
    : null;

  return {
    ...summarize({ isLong, entry, riskDistance, highestHigh, lowestLow }),
    tp1Hit: Boolean(hitAt.tp1), tp2Hit: Boolean(hitAt.tp2), tp3Hit: Boolean(hitAt.tp3),
    slHit: Boolean(slHitAt),
    tp1HitAt: hitAt.tp1, tp2HitAt: hitAt.tp2, tp3HitAt: hitAt.tp3, slHitAt,
    outcome, exitPrice, exitReason, exitAt,
    breakevenActivated, finalStopPrice: currentStop,
    candlesUsed, windowLastClose,
  };
}

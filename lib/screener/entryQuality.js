import { ema as emaSeries } from "../technical/indicators.js";

/**
 * ENTRY QUALITY — "harga sekarang masih layak dimasuki atau sudah kemahalan?"
 *
 * Screener versi lama hanya menilai KEKUATAN gerakan (momentum, volume,
 * breakout). Masalahnya: coin yang sudah lari 15% dari level breakout justru
 * mendapat momentum score paling tinggi, padahal itu justru entry paling
 * berisiko — risiko ke stop loss membesar, ruang ke target menyempit.
 *
 * Modul ini mengukur POSISI HARGA relatif terhadap setup-nya, bukan kekuatannya.
 * Semua jarak diukur dalam satuan ATR (bukan persen mentah), supaya adil untuk
 * coin volatil maupun coin kalem — 5% di BTC dan 5% di altcoin receh bukan
 * jarak yang sama.
 *
 * Empat komponen, semuanya sadar arah (BULLISH / BEARISH):
 *   1. extension  — jarak harga ke EMA20 (nilai wajar). Mendeteksi lilin parabolik.
 *   2. chase      — jarak harga MELEWATI level pemicu (previous high/low).
 *                   Ini yang menangkap "kamu telat masuk setelah breakout".
 *   3. leg        — berapa jauh kaki gerakan ini sudah berjalan dari swing terakhir.
 *   4. riskReward — (TP1 - entry) / (entry - SL) dari harga SEKARANG.
 *                   Paling langsung: masih ada ruang untung, atau tinggal sisa?
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Skor menurun linear: <= good -> 100, >= bad -> 0. */
function decayScore(value, good, bad) {
  if (!Number.isFinite(value)) return null;
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return Number((100 * (1 - (value - good) / (bad - good))).toFixed(2));
}

/** Skor menaik linear: <= bad -> 0, >= good -> 100. */
function growthScore(value, bad, good) {
  if (!Number.isFinite(value)) return null;
  if (value <= bad) return 0;
  if (value >= good) return 100;
  return Number((100 * ((value - bad) / (good - bad))).toFixed(2));
}

function weightedAverage(parts) {
  let totalWeight = 0;
  let total = 0;
  parts.forEach(({ score, weight }) => {
    if (score === null || score === undefined) return;
    total += score * weight;
    totalWeight += weight;
  });
  if (totalWeight === 0) return null;
  return Number((total / totalWeight).toFixed(2));
}

export function describeEntryQuality(entryScore, config) {
  if (entryScore === null || entryScore === undefined) return "UNKNOWN";
  if (entryScore >= config.ENTRY_GOOD_MIN_SCORE) return "GOOD";
  if (entryScore >= config.ENTRY_FAIR_MIN_SCORE) return "FAIR";
  if (entryScore >= config.ENTRY_EXTENDED_MIN_SCORE) return "EXTENDED";
  return "OVEREXTENDED";
}

/** Urutan kualitas untuk keperluan filter & perbandingan di UI. */
export const ENTRY_QUALITY_RANK = { OVEREXTENDED: 0, EXTENDED: 1, UNKNOWN: 1, FAIR: 2, GOOD: 3 };

/**
 * Harga retest yang lebih sehat untuk ditunggu, kalau harga sekarang sudah jauh.
 * Diambil dari kandidat yang MASIH DI SISI AMAN dari harga sekarang:
 * EMA20, level pemicu yang baru ditembus, dan harga - 1 ATR.
 * Untuk BULLISH dipilih yang PALING DEKAT di bawah harga (pullback paling dangkal
 * yang masuk akal), untuk BEARISH kebalikannya.
 */
function suggestBetterEntry({ price, direction, anchor, triggerLevel, atr }) {
  if (!Number.isFinite(price) || !Number.isFinite(atr) || atr <= 0) return null;

  const candidates = [anchor, triggerLevel, direction === "BULLISH" ? price - atr : price + atr].filter((v) =>
    Number.isFinite(v)
  );

  const valid =
    direction === "BULLISH"
      ? candidates.filter((v) => v > 0 && v < price)
      : candidates.filter((v) => v > 0 && v > price);

  if (valid.length === 0) return null;

  const chosen = direction === "BULLISH" ? Math.max(...valid) : Math.min(...valid);
  return Number(chosen.toFixed(8));
}

export function computeEntryQuality({ price, direction, candles, breakout, tradeIdea, atr, config }) {
  const empty = {
    entryScore: null,
    entryLabel: "UNKNOWN",
    extensionAtr: null,
    chaseAtr: null,
    legAtr: null,
    riskReward: null,
    chaseGapPct: null,
    betterEntry: null,
    betterEntryGapPct: null,
    components: {},
  };

  const isDirectional = direction === "BULLISH" || direction === "BEARISH";
  if (!isDirectional || !Number.isFinite(price) || price <= 0) return empty;
  if (!Number.isFinite(atr) || atr <= 0) return empty;
  if (!Array.isArray(candles) || candles.length < config.ENTRY_ANCHOR_PERIOD) return empty;

  const bullish = direction === "BULLISH";

  // --- 1. Extension: seberapa jauh harga dari nilai wajar (EMA20) -----------
  const closes = candles.map((c) => c.close).filter((v) => Number.isFinite(v));
  const anchorSeries = emaSeries(closes, config.ENTRY_ANCHOR_PERIOD);
  const anchor = anchorSeries.length ? anchorSeries[anchorSeries.length - 1] : null;
  const extensionAtr = Number.isFinite(anchor) ? (bullish ? price - anchor : anchor - price) / atr : null;
  const extensionScore = decayScore(extensionAtr, config.ENTRY_EXTENSION_GOOD_ATR, config.ENTRY_EXTENSION_BAD_ATR);

  // --- 2. Chase: seberapa jauh harga sudah MELEWATI level pemicu ------------
  // Nilai negatif = harga belum menembus level (justru bagus, entry lebih awal).
  const triggerLevel = bullish ? breakout?.previousHigh : breakout?.previousLow;
  const chaseAtr = Number.isFinite(triggerLevel)
    ? (bullish ? price - triggerLevel : triggerLevel - price) / atr
    : null;
  const chaseGapPct = Number.isFinite(triggerLevel)
    ? Number((((bullish ? price - triggerLevel : triggerLevel - price) / triggerLevel) * 100).toFixed(4))
    : null;
  const chaseScore = decayScore(chaseAtr, config.ENTRY_CHASE_GOOD_ATR, config.ENTRY_CHASE_BAD_ATR);

  // --- 3. Leg: berapa panjang kaki gerakan ini sudah berjalan ---------------
  const legWindow = candles.slice(-config.ENTRY_LEG_LOOKBACK);
  const swingLow = Math.min(...legWindow.map((c) => c.low).filter((v) => Number.isFinite(v)));
  const swingHigh = Math.max(...legWindow.map((c) => c.high).filter((v) => Number.isFinite(v)));
  const legBase = bullish ? swingLow : swingHigh;
  const legAtr = Number.isFinite(legBase) ? Math.abs(price - legBase) / atr : null;
  const legScore = decayScore(legAtr, config.ENTRY_LEG_GOOD_ATR, config.ENTRY_LEG_BAD_ATR);

  // --- 4. Risk/reward dari harga SEKARANG ke TP1 ----------------------------
  const slPrice = tradeIdea?.stopLoss?.price ?? null;
  const tp1 = tradeIdea?.takeProfit?.tp1 ?? null;
  let riskReward = null;
  if (Number.isFinite(slPrice) && Number.isFinite(tp1)) {
    const risk = Math.abs(price - slPrice);
    const reward = Math.abs(tp1 - price);
    // Arah harus masuk akal: TP di sisi profit, SL di sisi rugi.
    const sane = bullish ? tp1 > price && slPrice < price : tp1 < price && slPrice > price;
    if (sane && risk > 0) riskReward = Number((reward / risk).toFixed(4));
    else if (!sane) riskReward = 0;
  }
  const rrScore = growthScore(riskReward, config.ENTRY_RR_BAD, config.ENTRY_RR_GOOD);

  const components = {
    extensionScore,
    chaseScore,
    legScore,
    rrScore,
  };

  const entryScore = weightedAverage([
    { score: extensionScore, weight: config.ENTRY_WEIGHT_EXTENSION },
    { score: chaseScore, weight: config.ENTRY_WEIGHT_CHASE },
    { score: legScore, weight: config.ENTRY_WEIGHT_LEG },
    { score: rrScore, weight: config.ENTRY_WEIGHT_RR },
  ]);

  const entryLabel = describeEntryQuality(entryScore, config);

  const betterEntry =
    entryLabel === "EXTENDED" || entryLabel === "OVEREXTENDED"
      ? suggestBetterEntry({ price, direction, anchor, triggerLevel, atr })
      : null;

  return {
    entryScore,
    entryLabel,
    extensionAtr: extensionAtr === null ? null : Number(extensionAtr.toFixed(4)),
    chaseAtr: chaseAtr === null ? null : Number(chaseAtr.toFixed(4)),
    legAtr: legAtr === null ? null : Number(legAtr.toFixed(4)),
    riskReward,
    chaseGapPct,
    betterEntry,
    betterEntryGapPct:
      betterEntry === null ? null : Number((((price - betterEntry) / price) * 100).toFixed(2)),
    components,
  };
}

/**
 * Skor gabungan untuk mengurutkan daftar: kekuatan setup DAN kelayakan harga.
 * Dipakai sebagai opsi urutan "Entry terbaik" di UI. Skor screener asli tetap
 * disimpan apa adanya supaya mesin kalibrasi tidak kehilangan basis pembanding.
 */
export function computeEntryAdjustedScore(screenerScore, entryScore, config) {
  if (screenerScore === null || screenerScore === undefined) return null;
  if (entryScore === null || entryScore === undefined) return screenerScore;
  const blended =
    screenerScore * (1 - config.ENTRY_ADJUSTED_BLEND) + entryScore * config.ENTRY_ADJUSTED_BLEND;
  return Number(clamp(blended, 0, 100).toFixed(2));
}

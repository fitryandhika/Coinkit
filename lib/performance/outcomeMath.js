import { PERFORMANCE_CONFIG } from "./config.js";

/**
 * Menerjemahkan satu baris prediction + outcome menjadi hasil yang BISA
 * dibandingkan antar coin dan antar timeframe, yaitu R (kelipatan risiko awal).
 *
 * Kenapa perlu: kolom `maximum_r` yang lama memakai Math.abs() sehingga SELALU
 * positif — itu MFE (harga terbaik yang sempat tercapai), bukan hasil nyata.
 * Merata-ratakannya menghasilkan "avg R" yang tidak pernah bisa negatif, jadi
 * mustahil dipakai menilai apakah screener benar atau salah.
 */

function isLongDecision(decision) {
  return decision === "LONG" || decision === "BUY";
}

/**
 * JEBAKAN: Number(null) === 0 dan Number.isFinite(0) === true. Tanpa penjaga ini,
 * exit_price yang kosong terbaca sebagai "harga 0" dan menghasilkan kerugian palsu
 * puluhan R yang diam-diam meracuni seluruh kalibrasi. Semua pembacaan angka dari
 * database HARUS lewat sini.
 */
export function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function roundTripFeePct(market, config = PERFORMANCE_CONFIG) {
  const perSide = config.FEE_PCT[market] ?? config.FEE_PCT.futures;
  return perSide * 2;
}

/** % perubahan dari entry ke sebuah harga, sudah disesuaikan arah posisi. */
export function directionalPct({ decision, entry, price }) {
  const e = num(entry);
  const p = num(price);
  if (e === null || p === null || e === 0) return null;
  entry = e;
  price = p;
  const raw = ((price - entry) / entry) * 100;
  return isLongDecision(decision) ? raw : -raw;
}

/**
 * Hasil nyata dalam R, sudah dikurangi fee.
 * Urutan sumber harga keluar: exit_price (paling akurat) -> level TP/SL yang
 * tersentuh -> null (tidak bisa dihitung, jangan ditebak).
 */
export function computeRealizedR(prediction, outcome, config = PERFORMANCE_CONFIG) {
  const entry = num(prediction?.entry);
  const stopLoss = num(prediction?.stop_loss);
  if (entry === null || stopLoss === null || entry === 0) {
    return { realizedR: null, netPct: null, riskPct: null, exitSource: "NO_LEVELS" };
  }

  const riskPct = (Math.abs(entry - stopLoss) / entry) * 100;
  if (riskPct <= 0) return { realizedR: null, netPct: null, riskPct: null, exitSource: "ZERO_RISK" };

  let grossPct = null;
  let exitSource = null;

  const exitPrice = num(outcome?.exit_price);
  if (exitPrice !== null && exitPrice > 0) {
    grossPct = directionalPct({ decision: prediction.decision, entry, price: exitPrice });
    exitSource = "EXIT_PRICE";
  } else {
    const byOutcome = {
      SL_HIT: () => -riskPct,
      TP3_HIT: () => directionalPct({ decision: prediction.decision, entry, price: num(prediction.tp3) }),
      TP2_HIT: () => directionalPct({ decision: prediction.decision, entry, price: num(prediction.tp2) }),
      TP1_HIT: () => directionalPct({ decision: prediction.decision, entry, price: num(prediction.tp1) }),
    };
    const fn = byOutcome[outcome?.outcome];
    if (fn) {
      grossPct = fn();
      exitSource = outcome.outcome === "SL_HIT" ? "STOP_LEVEL" : "TP_LEVEL";
    }
  }

  if (grossPct === null || !Number.isFinite(grossPct)) {
    // EXPIRED tanpa exit_price = harga akhir tidak pernah dicatat. Jangan ditebak
    // dari maximum_gain (itu titik terbaik, bukan titik keluar).
    return { realizedR: null, netPct: null, riskPct: Number(riskPct.toFixed(4)), exitSource: "UNKNOWN" };
  }

  const netPct = grossPct - roundTripFeePct(prediction.market, config);

  return {
    realizedR: Number((netPct / riskPct).toFixed(4)),
    netPct: Number(netPct.toFixed(4)),
    grossPct: Number(grossPct.toFixed(4)),
    riskPct: Number(riskPct.toFixed(4)),
    exitSource,
  };
}

/** MFE / MAE dalam R — berguna untuk melihat apakah TP terlalu jauh atau SL terlalu ketat. */
export function computeExcursions(prediction, outcome) {
  const entry = num(prediction?.entry);
  const stopLoss = num(prediction?.stop_loss);
  if (entry === null || stopLoss === null || entry === 0) return { mfeR: null, maeR: null };

  const riskPct = (Math.abs(entry - stopLoss) / entry) * 100;
  if (riskPct <= 0) return { mfeR: null, maeR: null };

  const gain = num(outcome?.maximum_gain_pct);
  const drawdown = num(outcome?.maximum_drawdown_pct);

  return {
    mfeR: gain === null ? null : Number((gain / riskPct).toFixed(4)),
    maeR: drawdown === null ? null : Number((drawdown / riskPct).toFixed(4)),
  };
}

import { RISK_CONFIG } from "../../config/risk.js";

/**
 * Kalibrasi 2026-09-04 (n=638): 45% setup punya R:R ke TP1 di bawah 1.0,
 * median 0.92. Penyebabnya ada di sini — versi lama memakai `levels[0]`
 * (resistance/support terdekat) sebagai TP1 tanpa memeriksa jaraknya
 * terhadap 1R. Padahal stop loss sekarang DILEBARKAN ke jarak minimum
 * (lihat stopLoss.js), jadi risiko membesar sementara TP tetap di level
 * terdekat -> R:R runtuh.
 *
 * Efeknya fatal secara aritmatika: dengan R:R 0.92, sistem butuh win rate
 * di atas 52% cuma untuk balik modal. Itu bukan masalah model, itu masalah
 * desain target.
 *
 * Perbaikan: level struktur hanya dipakai kalau jaraknya >= MIN_RR_TP1.
 * Level yang terlalu dekat DILEWATI (bukan dipakai lalu diberi penalti) —
 * kalau tidak ada level yang cukup jauh, jatuh ke kelipatan R.
 */

/** Jarak sebuah level target dari entry, dalam satuan R. */
function rrOf(level, entryPrice, riskDistance, direction) {
  if (!Number.isFinite(level) || !Number.isFinite(riskDistance) || riskDistance <= 0) return null;
  const reward = direction === "LONG" ? level - entryPrice : entryPrice - level;
  return reward / riskDistance;
}

export function resolveTakeProfit({
  direction, entryPrice, stopLossPrice, support, resistance, config = RISK_CONFIG,
}) {
  const empty = { tp1: null, tp2: null, tp3: null, source: "UNKNOWN", rr: { tp1: null, tp2: null, tp3: null }, rejectedLevels: 0 };
  if (entryPrice === null || stopLossPrice === null || entryPrice === undefined || stopLossPrice === undefined) {
    return empty;
  }

  const riskDistance = Math.abs(entryPrice - stopLossPrice);
  if (!Number.isFinite(riskDistance) || riskDistance <= 0) return empty;

  const rrFallback = (multiplier) =>
    direction === "LONG" ? entryPrice + riskDistance * multiplier : entryPrice - riskDistance * multiplier;

  const rawLevels =
    direction === "LONG"
      ? (resistance || []).filter((level) => level > entryPrice).sort((a, b) => a - b)
      : (support || []).filter((level) => level < entryPrice).sort((a, b) => b - a);

  const minRr = config.MIN_RR_TP1 ?? 1.5;
  const maxRr = config.MAX_RR_STRUCTURE_TP ?? 6;
  const spacing = config.MIN_RR_SPACING ?? 0.5;
  const multipliers = config.DEFAULT_TP_RR_MULTIPLIERS;

  // Level struktur tetap diprioritaskan — tapi hanya yang berada di jendela
  // R:R yang masuk akal. Terlalu dekat (< minRr) = R:R runtuh; terlalu jauh
  // (> maxRr) = target yang praktis tidak pernah kena, dan slot TP1 terbuang.
  const picked = [];
  let lastRr = minRr - spacing;
  let rejectedTooClose = 0;
  let rejectedTooFar = 0;

  for (const level of rawLevels) {
    const rr = rrOf(level, entryPrice, riskDistance, direction);
    if (rr === null) continue;
    if (rr < minRr) { rejectedTooClose += 1; continue; }
    if (rr > maxRr) { rejectedTooFar += 1; continue; }
    if (rr < lastRr + spacing) continue; // berimpit dengan target sebelumnya
    picked.push({ price: level, rr, source: "STRUCTURE" });
    lastRr = rr;
    if (picked.length === 3) break;
  }

  const structureUsed = picked.length;

  // Sisa slot diisi kelipatan R, selalu di LUAR target terakhir supaya
  // tp1 < tp2 < tp3 (atau sebaliknya untuk SHORT) tidak pernah terbalik.
  let slot = 0;
  while (picked.length < 3) {
    const base = multipliers[Math.min(slot, multipliers.length - 1)] + (slot >= multipliers.length ? slot : 0);
    // Jarak antar target fallback minimal 1R, bukan cuma `spacing` — dua target
    // yang cuma beda 0.5R praktis adalah target yang sama.
    const rr = Math.max(base, minRr, lastRr + Math.max(spacing, 1));
    picked.push({ price: rrFallback(rr), rr, source: "RR" });
    lastRr = rr;
    slot += 1;
  }

  const [t1, t2, t3] = picked;

  const round = (v) => Number(v.toFixed(8));

  return {
    tp1: round(t1.price),
    tp2: round(t2.price),
    tp3: round(t3.price),
    source: structureUsed >= 3 ? "SUPPORT_RESISTANCE" : structureUsed > 0 ? "MIXED" : "RISK_REWARD",
    rr: {
      tp1: Number(t1.rr.toFixed(3)),
      tp2: Number(t2.rr.toFixed(3)),
      tp3: Number(t3.rr.toFixed(3)),
    },
    // Diagnostik untuk kalibrasi: kalau rejectedTooClose besar, banyak setup
    // memang lahir dengan R:R buruk. Kalau rejectedTooFar besar, ambang
    // MAX_RR_STRUCTURE_TP mungkin kelewat ketat.
    rejectedTooClose,
    rejectedTooFar,
  };
}

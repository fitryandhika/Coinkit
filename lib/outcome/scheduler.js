import { OUTCOME_CONFIG } from "./config.js";

export function horizonHoursOf(evaluationHorizon, config = OUTCOME_CONFIG) {
  return config.HORIZON_HOURS[evaluationHorizon] ?? config.HORIZON_HOURS[config.DEFAULT_HORIZON];
}

/** Waktu (ms) saat horizon evaluasi sebuah setup HABIS. Ini batas keras: tidak
 * ada satu pun candle setelah titik ini yang boleh ikut menilai setup. */
export function horizonEndMs({ timestamp, evaluationHorizon, config = OUTCOME_CONFIG }) {
  return new Date(timestamp).getTime() + horizonHoursOf(evaluationHorizon, config) * 60 * 60 * 1000;
}

export function isExpired({ timestamp, evaluationHorizon, nowMs, config = OUTCOME_CONFIG }) {
  return nowMs >= horizonEndMs({ timestamp, evaluationHorizon, config });
}

/**
 * Jadwal pengecekan berikutnya, DIBATASI oleh akhir horizon.
 *
 * Dulu jadwal bisa jatuh jauh setelah horizon habis, jadi setup baru diperiksa
 * berhari-hari kemudian dan hasilnya dihitung dari rentang waktu yang salah.
 * Sekarang pengecekan terakhir selalu tepat di akhir horizon (+ jeda kecil
 * supaya candle penutup sudah tersedia di API).
 */
export function nextCheckAt({ timeframe, nowMs, horizonEnd = null, config = OUTCOME_CONFIG }) {
  const minutes = config.CHECK_INTERVAL_MINUTES[timeframe] ?? 30;
  let target = nowMs + minutes * 60 * 1000;
  if (Number.isFinite(horizonEnd)) {
    const finalCheck = horizonEnd + 2 * 60 * 1000;
    if (target > finalCheck) target = Math.max(finalCheck, nowMs + 60 * 1000);
  }
  return new Date(target).toISOString();
}

export function isDueForCheck({ nextCheckAtIso, nowMs }) {
  if (!nextCheckAtIso) return true;
  return new Date(nextCheckAtIso).getTime() <= nowMs;
}

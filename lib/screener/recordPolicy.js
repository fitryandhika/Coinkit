import { SCREENER_CONFIG as DEFAULT_CONFIG } from "./config.js";
import { OUTCOME_CONFIG } from "../outcome/config.js";

/**
 * Aturan MURNI soal "setup ini dicatat atau tidak".
 *
 * Sengaja dipisah dari autoRecord.js yang menyentuh database: logika keputusan
 * jadi bisa diuji langsung (npm test) tanpa Supabase, dan alasan penolakan bisa
 * dilaporkan ke endpoint perekam — bukan hilang diam-diam seperti sebelumnya.
 */

export const HORIZON_BY_TIMEFRAME = {
  "5m": "4H",
  "15m": "4H",
  "1h": "24H",
  "4h": "48H",
  "1d": "72H",
};

export function horizonForTimeframe(timeframe) {
  return HORIZON_BY_TIMEFRAME[timeframe] || "24H";
}

/**
 * @returns {{ record: boolean, isControl?: boolean, reason: string }}
 * `reason` selalu diisi, termasuk saat setup dicatat — supaya ringkasan
 * perekam bisa menunjukkan KENAPA jumlahnya sedikit, bukan cuma berapa.
 */
export function decideRecording(entry, config = DEFAULT_CONFIG, random = Math.random) {
  if (!entry) return { record: false, reason: "NO_ENTRY" };
  if (entry.screenerScore === null || entry.screenerScore === undefined) {
    return { record: false, reason: entry.scoreRejectReason || "NO_SCORE" };
  }
  if (entry.direction === "NEUTRAL") return { record: false, reason: "NEUTRAL_DIRECTION" };
  if (!entry.tradeIdea?.entry) return { record: false, reason: "NO_TRADE_LEVELS" };

  const controlMin = config.CONTROL_MIN_SCORE;
  const controlRate = config.CONTROL_SAMPLE_RATE;
  const passesControlDraw = entry.screenerScore >= controlMin && random() < controlRate;

  // Setup yang harganya sudah kemahalan TIDAK dicatat sebagai rekomendasi, tapi
  // tetap boleh masuk control group supaya mesin kalibrasi bisa MEMBUKTIKAN
  // bahwa menyaringnya memang menaikkan win rate.
  if (entry.entryLabel === "OVEREXTENDED") {
    if (passesControlDraw) return { record: true, isControl: true, reason: "CONTROL_OVEREXTENDED" };
    return { record: false, reason: "OVEREXTENDED" };
  }

  if (entry.screenerScore >= config.MIN_SCORE_TO_RECORD) {
    return { record: true, isControl: false, reason: "ABOVE_THRESHOLD" };
  }
  if (passesControlDraw) return { record: true, isControl: true, reason: "CONTROL_SAMPLE" };
  return { record: false, reason: "BELOW_THRESHOLD" };
}

/**
 * Apakah prediction PENDING yang sudah ada BOLEH memblokir pencatatan baru?
 *
 * Ini perbaikan inti dari kemacetan 6-11 September. Dedup versi lama memblokir
 * selama status masih PENDING — tanpa melihat apakah horizonnya sudah habis.
 * Begitu worker evaluasi berhenti, setiap symbol yang pernah tercatat ikut
 * membeku SELAMANYA: worker mati -> tidak ada yang jadi COMPLETED -> tidak ada
 * setup baru boleh dicatat -> riwayat berhenti tanpa satu pun pesan error.
 *
 * Sekarang: PENDING yang horizonnya sudah lewat (+ jeda) dianggap TIDAK aktif.
 * Setup lama tetap ada dan tetap akan dievaluasi worker; dia cuma tidak lagi
 * menyandera symbol-nya.
 */
export function duplicateBlocks(existing, nowMs, config = OUTCOME_CONFIG) {
  if (!existing) return false;

  const startMs = new Date(existing.timestamp).getTime();
  // Baris tanpa timestamp yang bisa dibaca: bersikap konservatif, tetap blokir.
  if (!Number.isFinite(startMs)) return true;

  const hours =
    config.HORIZON_HOURS[existing.evaluation_horizon] ?? config.HORIZON_HOURS[config.DEFAULT_HORIZON];
  const horizonEnd = startMs + hours * 60 * 60 * 1000;
  const grace = config.STALE_PENDING_GRACE_MS ?? 15 * 60 * 1000;

  return nowMs < horizonEnd + grace;
}

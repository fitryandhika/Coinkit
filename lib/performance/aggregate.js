import { getSupabaseClient } from "@/lib/db/supabaseClient";
import { SCREENER_CONFIG } from "@/lib/screener/config";
import { buildCalibrationReport } from "./calibration.js";
import { PERFORMANCE_CONFIG } from "./config.js";
import { CURRENT_RULESET_VERSION } from "@/config/ruleset";

/**
 * Laporan performa sekarang berpusat pada satu pertanyaan: apakah Screener Score
 * benar-benar memprediksi hasil di market?
 *
 * Perubahan penting dari versi sebelumnya:
 *  - Metrik utama bukan lagi `maximum_r` (yang memakai Math.abs sehingga tidak
 *    pernah negatif = MFE, bukan hasil). Sekarang realized R sudah dikurangi fee.
 *  - Sub-score ikut dianalisa, jadi terlihat komponen mana yang berjasa.
 *  - Ada control group sebagai pembanding.
 */
/** Ambil + gabungkan prediction/snapshot/outcome. Dipakai laporan kalibrasi
 * DAN export CSV, supaya keduanya tidak pernah berbeda isi. */
export async function fetchJoinedRows({ limit = 1000 } = {}) {
  const supabase = getSupabaseClient();

  const { data: outcomeRows, error } = await supabase
    .from("prediction_outcomes")
    .select("*, ai_predictions(*)")
    .order("evaluation_started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal mengambil outcome: ${error.message}`);

  const rows = (outcomeRows || []).filter((r) => r.ai_predictions);
  const predictionIds = rows.map((r) => r.prediction_id);

  // Snapshot HARUS diambil per potongan.
  //
  // Bug versi lama: satu `.in("prediction_id", [...973 uuid])` dirakit jadi
  // query string ~35 KB. PostgREST/proxy menolak di ~4-8 KB (414 URI Too
  // Long), dan karena `error` tidak pernah diperiksa, kegagalannya diam:
  // snapshotMap kosong -> SEMUA kolom asal snapshot (momentum_score,
  // volume_score, breakout_score, raw_score, penalty, direction,
  // structure_bias, volume_ratio, breakout_status, exhaustion_status)
  // keluar kosong di CSV & laporan kalibrasi. Kolom asal ai_predictions dan
  // prediction_outcomes tetap terisi — itulah kenapa gejalanya terlihat
  // seperti "sub-score tidak pernah dicatat", padahal datanya ada di DB.
  //
  // Efeknya baru muncul setelah data menumpuk: di bawah ~150 setup URL-nya
  // masih muat, jadi ini lolos dari pengujian awal.
  const CHUNK = 100;
  const snapshots = [];
  for (let i = 0; i < predictionIds.length; i += CHUNK) {
    const slice = predictionIds.slice(i, i + CHUNK);
    const { data, error: snapErr } = await supabase
      .from("prediction_snapshots")
      .select("*")
      .in("prediction_id", slice);
    // Sengaja dilempar, tidak ditelan. Export yang diam-diam kehilangan
    // separuh kolomnya jauh lebih berbahaya daripada export yang gagal:
    // yang pertama menghasilkan kesimpulan kalibrasi yang salah.
    if (snapErr) throw new Error(`Gagal mengambil snapshot: ${snapErr.message}`);
    if (data) snapshots.push(...data);
  }
  const snapshotMap = new Map(snapshots.map((s) => [s.prediction_id, s]));

  return rows.map((r) => ({
    prediction: r.ai_predictions,
    snapshot: snapshotMap.get(r.prediction_id) ?? null,
    outcome: r,
  }));
}

export async function buildPerformanceReport({ limit = 1000, rulesetVersion = null } = {}) {
  const joined = await fetchJoinedRows({ limit });
  const report = buildCalibrationReport(joined, SCREENER_CONFIG, PERFORMANCE_CONFIG, { rulesetVersion });

  return {
    ...report,
    feeAssumption: PERFORMANCE_CONFIG.FEE_PCT,
    currentRulesetVersion: CURRENT_RULESET_VERSION,
    insufficientData: report.scoreCalibration.sampleSize < PERFORMANCE_CONFIG.MIN_SAMPLE_FOR_VERDICT,
  };
}

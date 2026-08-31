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

  const { data: snapshots } = await supabase
    .from("prediction_snapshots")
    .select("*")
    .in("prediction_id", predictionIds.length ? predictionIds : ["__none__"]);
  const snapshotMap = new Map((snapshots || []).map((s) => [s.prediction_id, s]));

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

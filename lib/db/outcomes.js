import { getSupabaseClient } from "./supabaseClient";

export async function initOutcome(predictionId, { startedAt, nextCheckAt }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("prediction_outcomes").upsert({
    prediction_id: predictionId,
    evaluation_started_at: startedAt,
    next_check_at: nextCheckAt,
    outcome: "PENDING",
    status: "PENDING",
  });
  if (error) throw new Error(`Gagal inisialisasi outcome: ${error.message}`);
}

export async function getOutcome(predictionId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("prediction_outcomes").select("*").eq("prediction_id", predictionId).single();
  if (error) return null;
  return data;
}

export async function updateOutcome(predictionId, patch) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("prediction_outcomes").update(patch).eq("prediction_id", predictionId);
  if (error) throw new Error(`Gagal update outcome: ${error.message}`);
}

export async function listOutcomes({ status, limit = 500 } = {}) {
  const supabase = getSupabaseClient();
  let query = supabase.from("prediction_outcomes").select("*, ai_predictions(*)").order("evaluation_started_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Gagal mengambil daftar outcome: ${error.message}`);
  return data;
}

/**
 * Antrean evaluasi yang BENAR: outcome yang masih PENDING dan sudah waktunya
 * dicek, diurutkan dari yang paling telat.
 *
 * Versi lama memakai listDuePredictions() yang mengambil 20 baris TANPA .order()
 * dan tanpa melihat next_check_at sama sekali. Supabase mengembalikan baris yang
 * kurang lebih sama setiap kali, jadi sebagian setup tidak pernah kebagian
 * diperiksa — dan karena dedup autoRecord memblokir symbol yang masih PENDING,
 * symbol itu ikut membeku selamanya.
 */
export async function listDueOutcomes({ nowIso, limit = 120 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("prediction_outcomes")
    .select("*, ai_predictions!inner(*)")
    .eq("status", "PENDING")
    .eq("ai_predictions.status", "PENDING")
    .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw new Error(`Gagal mengambil antrean evaluasi: ${error.message}`);
  return (data || []).filter((row) => row.ai_predictions);
}

/** Id outcome yang sudah ada, dipakai mencari prediction yang baris outcome-nya
 * belum sempat dibuat (mis. autoRecord gagal di tengah jalan). */
export async function listExistingOutcomeIds(predictionIds) {
  if (!predictionIds || predictionIds.length === 0) return new Set();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("prediction_outcomes")
    .select("prediction_id")
    .in("prediction_id", predictionIds);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.prediction_id));
}

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

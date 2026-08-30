import { getSupabaseClient } from "./supabaseClient";

function generatePredictionId(symbol) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `pred_${date}_${symbol}_${rand}`;
}

export async function createPrediction(data) {
  const supabase = getSupabaseClient();
  const id = generatePredictionId(data.symbol);

  const { error } = await supabase.from("ai_predictions").insert({
    id,
    timestamp: new Date().toISOString(),
    symbol: data.symbol,
    market: data.market,
    timeframe: data.timeframe,
    decision: data.decision,
    score: data.score,
    confidence: data.confidence,
    entry: data.entry,
    stop_loss: data.stopLoss,
    tp1: data.tp1,
    tp2: data.tp2,
    tp3: data.tp3,
    risk_percent: data.riskPercent,
    risk_amount: data.riskAmount,
    position_size: data.positionSize,
    leverage: data.leverage,
    risk_reward: data.riskReward,
    risk_score: data.riskScore,
    evaluation_horizon: data.evaluationHorizon || "24H",
    reasoning: data.reasoning || null,
    trail_atr: data.trailAtr ?? null,
    btc_correlation: data.btcCorrelation ?? null,
    trail_multiplier: data.trailMultiplier ?? null,
    is_control: data.isControl === true,
    status: "PENDING",
  });

  if (error) throw new Error(`Gagal menyimpan prediction: ${error.message}`);
  return id;
}

export async function getPrediction(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("ai_predictions").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

export async function listPredictions({ symbol, decision, status, includeControl = false, limit = 50 } = {}) {
  const supabase = getSupabaseClient();
  let query = supabase.from("ai_predictions").select("*").order("timestamp", { ascending: false }).limit(limit);
  // Setup kontrol (score di bawah ambang, dicatat sebagai pembanding acak) tidak
  // ditampilkan di riwayat biasa — hanya dipakai mesin kalibrasi.
  if (!includeControl) query = query.eq("is_control", false);
  if (symbol) query = query.eq("symbol", symbol);
  if (decision) query = query.eq("decision", decision);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Gagal mengambil daftar prediction: ${error.message}`);
  return data;
}

export async function updatePredictionStatus(id, status) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("ai_predictions").update({ status }).eq("id", id);
  if (error) throw new Error(`Gagal update status prediction: ${error.message}`);
}

export async function listDuePredictions({ statuses = ["PENDING"], limit = 50 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("ai_predictions").select("*").in("status", statuses).limit(limit);
  if (error) throw new Error(`Gagal mengambil prediction yang perlu dicek: ${error.message}`);
  return data;
}

/** Dedup untuk auto-record Screener: satu combo symbol+market+timeframe cuma boleh
 * punya SATU prediction PENDING aktif — tidak dicatat ulang sampai selesai. */
export async function findActivePrediction({ symbol, market, timeframe }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_predictions")
    .select("id")
    .eq("symbol", symbol)
    .eq("market", market)
    .eq("timeframe", timeframe)
    .eq("status", "PENDING")
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

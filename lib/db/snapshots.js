import { getSupabaseClient } from "./supabaseClient";

export async function createSnapshot(predictionId, snapshot) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("prediction_snapshots").insert({
    prediction_id: predictionId,
    price: snapshot.price,
    rsi: snapshot.rsi,
    macd: snapshot.macd,
    ema20: snapshot.ema?.[20] ?? null,
    ema50: snapshot.ema?.[50] ?? null,
    atr: snapshot.atr,
    adx: snapshot.adx,
    vwap: snapshot.vwap ?? null,
    volume: snapshot.volume?.currentVolume ?? null,
    volume_ratio: snapshot.volume?.volumeRatio ?? null,
    support: snapshot.support,
    resistance: snapshot.resistance,
    market_structure: snapshot.marketStructure,
    breakout_status: snapshot.breakoutStatus,
    exhaustion_status: snapshot.exhaustionStatus ?? null,
    market_regime: snapshot.marketRegime,
    funding_rate: snapshot.funding?.fundingRate ?? null,
    open_interest: snapshot.openInterest?.openInterest ?? null,
    technical_score: snapshot.technicalScore,
    screener_score: snapshot.screenerScore,
    risk_score: snapshot.riskScore,
    // Sub-score screener — bahan mentah mesin kalibrasi. Tanpa ini kita hanya
    // bisa tahu "score 80 hasilnya bagaimana", bukan "komponen mana penyebabnya".
    momentum_score: snapshot.momentumScore ?? null,
    volume_score: snapshot.volumeScore ?? null,
    liquidity_score: snapshot.liquidityScore ?? null,
    volatility_score: snapshot.volatilityScore ?? null,
    breakout_score: snapshot.breakoutScore ?? null,
    raw_score: snapshot.rawScore ?? null,
    penalty: snapshot.penalty ?? null,
    direction: snapshot.direction ?? null,
    structure_bias: snapshot.structureBias ?? null,
    btc_momentum_label: snapshot.btcMomentumLabel ?? null,
  });
  if (error) throw new Error(`Gagal menyimpan snapshot: ${error.message}`);
}

export async function getSnapshot(predictionId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("prediction_snapshots").select("*").eq("prediction_id", predictionId).single();
  if (error) return null;
  return data;
}

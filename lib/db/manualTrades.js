import { getSupabaseClient } from "./supabaseClient";

function generateTradeId() {
  return `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createManualTrade(predictionId, data) {
  const supabase = getSupabaseClient();
  const id = generateTradeId();

  let realizedPnl = null;
  let realizedPnlPct = null;
  if (data.actualEntry && data.actualExit && data.actualPositionSize) {
    const priceDiff = data.actualExit - data.actualEntry;
    realizedPnl = Number((priceDiff * data.actualPositionSize - (data.tradingFee || 0)).toFixed(8));
    realizedPnlPct = Number(((priceDiff / data.actualEntry) * 100).toFixed(4));
  }

  const { error } = await supabase.from("manual_trades").insert({
    id,
    prediction_id: predictionId,
    user_action: "TAKEN",
    actual_entry: data.actualEntry,
    actual_exit: data.actualExit ?? null,
    actual_position_size: data.actualPositionSize,
    actual_leverage: data.actualLeverage ?? null,
    actual_stop_loss: data.actualStopLoss ?? null,
    actual_take_profit: data.actualTakeProfit ?? null,
    trading_fee: data.tradingFee ?? null,
    realized_pnl: realizedPnl,
    realized_pnl_pct: realizedPnlPct,
    notes: data.notes ?? null,
    closed_at: data.actualExit ? new Date().toISOString() : null,
  });
  if (error) throw new Error(`Gagal menyimpan manual trade: ${error.message}`);
  return id;
}

export async function getManualTrade(predictionId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("manual_trades").select("*").eq("prediction_id", predictionId).order("created_at", { ascending: false }).limit(1).single();
  if (error) return null;
  return data;
}

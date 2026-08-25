import { findActivePrediction, createPrediction } from "@/lib/db/predictions";
import { createSnapshot } from "@/lib/db/snapshots";
import { initOutcome } from "@/lib/db/outcomes";
import { nextCheckAt } from "@/lib/outcome/scheduler";

const MIN_SCORE_TO_RECORD = 60; // hanya setup cukup kuat yang layak jadi data belajar
const HORIZON_BY_TIMEFRAME = { "5m": "4H", "15m": "4H", "1h": "24H", "4h": "48H", "1d": "72H" };

/**
 * Dipanggil dari dalam runScreener() untuk tiap coin. Dedup: satu combo
 * symbol+market+timeframe hanya boleh punya SATU prediction PENDING aktif —
 * tidak akan dicatat ulang sampai yang lama selesai (TP/SL/expired).
 * Gagal di sini TIDAK boleh menggagalkan response screener utama.
 */
export async function autoRecordIfEligible({ mode, timeframe, entry }) {
  if (entry.screenerScore === null || entry.screenerScore < MIN_SCORE_TO_RECORD) return;
  if (entry.direction === "NEUTRAL") return;
  if (!entry.tradeIdea?.entry) return;

  try {
    const existing = await findActivePrediction({ symbol: entry.symbol, market: mode, timeframe });
    if (existing) return;

    const decision = mode === "spot" ? "BUY" : entry.direction === "BULLISH" ? "LONG" : "SHORT";

    const id = await createPrediction({
      symbol: entry.symbol,
      market: mode,
      timeframe,
      decision,
      score: entry.screenerScore,
      confidence: null,
      entry: entry.tradeIdea.entry,
      stopLoss: entry.tradeIdea.stopLoss?.price ?? null,
      tp1: entry.tradeIdea.takeProfit?.tp1 ?? null,
      tp2: entry.tradeIdea.takeProfit?.tp2 ?? null,
      tp3: entry.tradeIdea.takeProfit?.tp3 ?? null,
      riskPercent: null,
      riskAmount: null,
      positionSize: null,
      leverage: null,
      riskReward: null,
      riskScore: null,
      evaluationHorizon: HORIZON_BY_TIMEFRAME[timeframe] || "24H",
      reasoning: {
        reasons: entry.reasons,
        momentumLabel: entry.momentumLabel,
        volumeLabel: entry.volumeLabel,
        liquidityLabel: entry.liquidityLabel,
        breakoutStatus: entry.breakout?.status,
      },
    });

    await createSnapshot(id, {
      price: entry.price,
      volume: entry.volume24h,
      volumeRatio: entry.volumeRatio,
      support: entry.tradeIdea.supportUsed ?? [],
      resistance: entry.tradeIdea.resistanceUsed ?? [],
      breakoutStatus: entry.breakout?.status,
      exhaustionStatus: entry.exhaustion?.status,
      screenerScore: entry.screenerScore,
    });

    await initOutcome(id, { startedAt: new Date().toISOString(), nextCheckAt: nextCheckAt({ timeframe, nowMs: Date.now() }) });
  } catch (err) {
    // gagal mencatat satu coin tidak boleh mengganggu response screener utama
  }
}

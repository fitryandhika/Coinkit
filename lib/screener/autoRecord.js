import { findActivePrediction, createPrediction } from "@/lib/db/predictions";
import { createSnapshot } from "@/lib/db/snapshots";
import { initOutcome } from "@/lib/db/outcomes";
import { nextCheckAt } from "@/lib/outcome/scheduler";
import { SCREENER_CONFIG } from "./config";
import { decideRecording, duplicateBlocks, horizonForTimeframe } from "./recordPolicy";

/**
 * Mencatat satu setup ke database, DAN MELAPORKAN hasilnya.
 *
 * Perubahan penting dari versi sebelumnya: fungsi ini tidak lagi menelan error.
 * Dulu isinya `catch {}` kosong dan pemanggilnya memakai `.catch(() => {})`,
 * jadi kegagalan pencatatan — kolom hilang, kredensial salah, koneksi putus —
 * tidak meninggalkan jejak apa pun. Gejalanya di layar cuma satu: riwayat
 * berhenti bertambah tanpa sebab yang terlihat.
 *
 * Sekarang setiap panggilan mengembalikan status, dan endpoint perekam
 * menampilkan ringkasannya.
 *
 * @returns {Promise<{symbol: string, status: "RECORDED"|"SKIPPED"|"DUPLICATE"|"ERROR", reason: string, id?: string, isControl?: boolean, error?: string}>}
 */
export async function autoRecordIfEligible({
  mode, timeframe, entry, btcMomentumLabel = null, config = SCREENER_CONFIG, nowMs = Date.now(),
}) {
  const symbol = entry?.symbol ?? "UNKNOWN";
  const decisionToRecord = decideRecording(entry, config);
  if (!decisionToRecord.record) {
    return { symbol, status: "SKIPPED", reason: decisionToRecord.reason };
  }

  try {
    const existing = await findActivePrediction({ symbol: entry.symbol, market: mode, timeframe });
    if (duplicateBlocks(existing, nowMs)) {
      return { symbol, status: "DUPLICATE", reason: "ACTIVE_PENDING" };
    }

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
      evaluationHorizon: horizonForTimeframe(timeframe),
      trailAtr: entry.atr ?? null,
      btcCorrelation: entry.btcCorrelation ?? null,
      trailMultiplier: entry.trailMultiplier ?? null,
      isControl: decisionToRecord.isControl,
      reasoning: {
        reasons: entry.reasons,
        momentumLabel: entry.momentumLabel,
        volumeLabel: entry.volumeLabel,
        liquidityLabel: entry.liquidityLabel,
        breakoutStatus: entry.breakout?.status,
        entryLabel: entry.entryLabel,
        entryScore: entry.entryScore,
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
      // --- bahan kalibrasi ---
      momentumScore: entry.momentumScore,
      volumeScore: entry.volumeScore,
      liquidityScore: entry.liquidityScore,
      volatilityScore: entry.volatilityScore,
      breakoutScore: entry.breakoutScore,
      rawScore: entry.rawScore,
      penalty: entry.penalty,
      direction: entry.direction,
      structureBias: entry.structureBias,
      btcMomentumLabel,
      // --- kelayakan harga entry (bahan kalibrasi baru) ---
      entryScore: entry.entryScore ?? null,
      entryLabel: entry.entryLabel ?? null,
      riskReward: entry.riskReward ?? null,
      chaseGapPct: entry.entryQuality?.chaseGapPct ?? null,
      extensionAtr: entry.entryQuality?.extensionAtr ?? null,
    });

    await initOutcome(id, {
      startedAt: new Date(nowMs).toISOString(),
      nextCheckAt: nextCheckAt({ timeframe, nowMs }),
    });

    return { symbol, status: "RECORDED", reason: decisionToRecord.reason, id, isControl: decisionToRecord.isControl };
  } catch (err) {
    // Tetap tidak boleh menggagalkan seluruh run — tapi WAJIB dilaporkan.
    return { symbol, status: "ERROR", reason: "DB_ERROR", error: err?.message || String(err) };
  }
}

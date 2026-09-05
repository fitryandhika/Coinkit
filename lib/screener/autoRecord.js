import { findActivePrediction, createPrediction } from "@/lib/db/predictions";
import { createSnapshot } from "@/lib/db/snapshots";
import { initOutcome } from "@/lib/db/outcomes";
import { nextCheckAt } from "@/lib/outcome/scheduler";
import { SCREENER_CONFIG } from "./config";

// Ambang diambil dari config supaya bisa diturunkan ulang tiap kali skala
// scoring berubah. Skala v3 tidak sama dengan v2 — angka 60 yang lama tidak
// lagi berarti hal yang sama, dan HARUS dikalibrasi ulang dari data baru.
const MIN_SCORE_TO_RECORD = SCREENER_CONFIG.MIN_SCORE_TO_RECORD;

// --- Control group -----------------------------------------------------------
// Sebagian kecil setup yang TIDAK lolos ambang tetap dicatat sebagai pembanding.
// Alasannya: tanpa kelompok pembanding, "win rate 55%" tidak bisa dinilai — bisa
// jadi setup acak di periode yang sama juga menghasilkan 55%. Baris ini ditandai
// is_control=true, disembunyikan dari riwayat, dan HANYA dipakai mesin kalibrasi.
const CONTROL_SAMPLE_RATE = SCREENER_CONFIG.CONTROL_SAMPLE_RATE; // ~6% dari setup di bawah ambang
const CONTROL_MIN_SCORE = SCREENER_CONFIG.CONTROL_MIN_SCORE; // di bawah ini datanya terlalu sampah untuk jadi pembanding

const HORIZON_BY_TIMEFRAME = { "5m": "4H", "15m": "4H", "1h": "24H", "4h": "48H", "1d": "72H" };

function shouldRecord(entry) {
  if (entry.screenerScore === null || entry.screenerScore === undefined) return null;
  if (entry.direction === "NEUTRAL") return null;
  if (!entry.tradeIdea?.entry) return null;

  // Setup yang harganya sudah kemahalan TIDAK dicatat sebagai rekomendasi —
  // percuma mencatat entry yang kita sendiri tidak akan ambil. Tapi tetap boleh
  // masuk control group, justru supaya mesin kalibrasi bisa MEMBUKTIKAN bahwa
  // menyaringnya memang menaikkan win rate.
  if (entry.entryLabel === "OVEREXTENDED") {
    if (entry.screenerScore >= CONTROL_MIN_SCORE && Math.random() < CONTROL_SAMPLE_RATE) {
      return { isControl: true };
    }
    return null;
  }

  if (entry.screenerScore >= MIN_SCORE_TO_RECORD) return { isControl: false };
  if (entry.screenerScore >= CONTROL_MIN_SCORE && Math.random() < CONTROL_SAMPLE_RATE) {
    return { isControl: true };
  }
  return null;
}

/**
 * Dipanggil dari dalam runScreener() untuk tiap coin. Dedup: satu combo
 * symbol+market+timeframe hanya boleh punya SATU prediction PENDING aktif —
 * tidak akan dicatat ulang sampai yang lama selesai (TP/SL/expired).
 * Gagal di sini TIDAK boleh menggagalkan response screener utama.
 */
export async function autoRecordIfEligible({ mode, timeframe, entry, btcMomentumLabel = null }) {
  const decisionToRecord = shouldRecord(entry);
  if (!decisionToRecord) return;

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

    await initOutcome(id, { startedAt: new Date().toISOString(), nextCheckAt: nextCheckAt({ timeframe, nowMs: Date.now() }) });
  } catch (err) {
    // gagal mencatat satu coin tidak boleh mengganggu response screener utama
  }
}

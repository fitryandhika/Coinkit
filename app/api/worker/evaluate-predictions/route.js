import { NextResponse } from "next/server";
import { listDuePredictions, updatePredictionStatus } from "@/lib/db/predictions";
import { initOutcome, updateOutcome, listDueOutcomes, listExistingOutcomeIds } from "@/lib/db/outcomes";
import { getSnapshot } from "@/lib/db/snapshots";
import { fetchOutcomeCandles } from "@/lib/outcome/monitor";
import { evaluateOutcome, evaluateTrailingOutcome } from "@/lib/outcome/evaluate";
import { evaluateWaitOutcome } from "@/lib/outcome/waitEvaluation";
import { isExpired, nextCheckAt, horizonEndMs, horizonHoursOf } from "@/lib/outcome/scheduler";
import { OUTCOME_CONFIG } from "@/lib/outcome/config";

export const maxDuration = 60;

function checkAuth(request) {
  const authHeader = request.headers.get("authorization");
  const vercelCronSecret = process.env.CRON_SECRET;
  if (vercelCronSecret && authHeader === `Bearer ${vercelCronSecret}`) return true;

  const url = new URL(request.url);
  const workerSecret = process.env.WORKER_SECRET;
  if (workerSecret && url.searchParams.get("secret") === workerSecret) return true;

  return false;
}

/**
 * Antrean kerja: outcome yang sudah waktunya dicek (paling telat dulu), ditambah
 * prediction yang baris outcome-nya belum sempat terbentuk. Yang kedua perlu
 * karena tanpa itu sebuah prediction bisa macet PENDING selamanya dan memblokir
 * symbol-nya dari pencatatan baru (dedup autoRecord).
 */
async function buildQueue(nowMs, limit) {
  const nowIso = new Date(nowMs).toISOString();
  const dueRows = await listDueOutcomes({ nowIso, limit });

  const queue = dueRows.map((row) => ({ prediction: row.ai_predictions, outcome: row }));
  const seen = new Set(queue.map((item) => item.prediction.id));

  const remaining = limit - queue.length;
  if (remaining <= 0) return queue;

  const pending = await listDuePredictions({ limit: Math.max(remaining * 2, 50) });
  const candidates = (pending || []).filter((p) => !seen.has(p.id));
  const withOutcome = await listExistingOutcomeIds(candidates.map((p) => p.id));

  for (const prediction of candidates) {
    if (queue.length >= limit) break;
    if (withOutcome.has(prediction.id)) continue;
    queue.push({ prediction, outcome: null });
  }

  return queue;
}

async function evaluateOne(prediction, existingOutcome, nowMs) {
  const horizonEnd = horizonEndMs({
    timestamp: prediction.timestamp,
    evaluationHorizon: prediction.evaluation_horizon,
  });
  const horizonHours = horizonHoursOf(prediction.evaluation_horizon);
  const expired = isExpired({
    timestamp: prediction.timestamp,
    evaluationHorizon: prediction.evaluation_horizon,
    nowMs,
  });

  if (!existingOutcome) {
    await initOutcome(prediction.id, {
      startedAt: prediction.timestamp,
      nextCheckAt: nextCheckAt({ timeframe: prediction.timeframe, nowMs, horizonEnd }),
    });
  }

  if (prediction.decision === "SELL") {
    await updateOutcome(prediction.id, {
      status: "COMPLETED",
      outcome: "NOT_APPLICABLE",
      evaluation_ended_at: new Date(nowMs).toISOString(),
      next_check_at: null,
    });
    await updatePredictionStatus(prediction.id, "COMPLETED");
    return "NOT_APPLICABLE";
  }

  const entryTimestamp = new Date(prediction.timestamp).getTime();
  const { candles, complete } = await fetchOutcomeCandles({
    market: prediction.market,
    symbol: prediction.symbol,
    entryTimestamp,
    nowMs,
    horizonEnd,
    horizonHours,
  });

  if (prediction.decision === "WAIT") {
    const snapshot = await getSnapshot(prediction.id);
    const evalResult = evaluateWaitOutcome({ referencePrice: snapshot?.price ?? null, candles });
    const finished = expired || evalResult.evaluation !== "PENDING";
    await updateOutcome(prediction.id, {
      maximum_gain_pct: evalResult.maximumMovePct,
      outcome: evalResult.evaluation,
      status: finished ? "COMPLETED" : "PENDING",
      evaluation_ended_at: finished ? new Date(nowMs).toISOString() : null,
      next_check_at: finished ? null : nextCheckAt({ timeframe: prediction.timeframe, nowMs, horizonEnd }),
    });
    if (finished) await updatePredictionStatus(prediction.id, "COMPLETED");
    return evalResult.evaluation;
  }

  // Tidak ada satu pun candle di dalam jendela. Kalau horizon sudah lewat, setup
  // ditutup sebagai NO_DATA supaya tidak menyumbat antrean. Hasilnya tidak ikut
  // statistik mana pun.
  if (candles.length === 0) {
    if (!expired) {
      await updateOutcome(prediction.id, {
        status: "PENDING",
        next_check_at: nextCheckAt({ timeframe: prediction.timeframe, nowMs, horizonEnd }),
      });
      return "PENDING";
    }
    await updateOutcome(prediction.id, {
      outcome: "NO_DATA",
      exit_reason: "NO_CANDLE_DATA",
      status: "COMPLETED",
      evaluation_ended_at: new Date(nowMs).toISOString(),
      next_check_at: null,
    });
    await updatePredictionStatus(prediction.id, "COMPLETED");
    return "NO_DATA";
  }

  // Prediction lama (sebelum fitur trailing SL) tidak punya trail_atr -> pakai
  // evaluasi SL/TP tetap. Dua-duanya kini sama-sama first-touch dan konservatif
  // saat satu candle menyentuh SL dan TP sekaligus.
  const hasTrailing = prediction.trail_atr !== null && prediction.trail_atr !== undefined;
  const args = {
    direction: prediction.decision,
    entry: prediction.entry,
    stopLoss: prediction.stop_loss,
    tp1: prediction.tp1,
    tp2: prediction.tp2,
    tp3: prediction.tp3,
    candles,
  };
  const evalResult = hasTrailing
    ? evaluateTrailingOutcome({
        ...args,
        trailAtr: prediction.trail_atr,
        trailMultiplier: prediction.trail_multiplier,
      })
    : evaluateOutcome(args);

  const hitSomething = evalResult.outcome !== "PENDING";
  const finished = hitSomething || expired;

  let finalOutcome = "PENDING";
  let exitPrice = null;
  let exitReason = null;

  if (hitSomething) {
    finalOutcome = evalResult.outcome;
    exitPrice = evalResult.exitPrice;
    exitReason = evalResult.exitReason;
  } else if (expired) {
    // Horizon habis tanpa menyentuh SL/TP. Harga keluar = CLOSE candle terakhir
    // DI DALAM jendela — bukan harga saat worker kebetulan berjalan. Inilah yang
    // dulu membuat ratusan setup selesai tanpa harga keluar sama sekali.
    finalOutcome = "EXPIRED";
    exitPrice = evalResult.windowLastClose;
    exitReason = complete ? "HORIZON_CLOSE" : "HORIZON_CLOSE_PARTIAL_DATA";
  }

  await updateOutcome(prediction.id, {
    maximum_gain_pct: evalResult.maximumGainPct,
    maximum_drawdown_pct: evalResult.maximumDrawdownPct,
    maximum_gain_price: evalResult.maximumGainPrice,
    maximum_drawdown_price: evalResult.maximumDrawdownPrice,
    maximum_r: evalResult.maximumR,
    tp1_hit: evalResult.tp1Hit,
    tp2_hit: evalResult.tp2Hit,
    tp3_hit: evalResult.tp3Hit,
    sl_hit: evalResult.slHit,
    tp1_hit_at: evalResult.tp1HitAt ? new Date(evalResult.tp1HitAt).toISOString() : null,
    tp2_hit_at: evalResult.tp2HitAt ? new Date(evalResult.tp2HitAt).toISOString() : null,
    tp3_hit_at: evalResult.tp3HitAt ? new Date(evalResult.tp3HitAt).toISOString() : null,
    sl_hit_at: evalResult.slHitAt ? new Date(evalResult.slHitAt).toISOString() : null,
    exit_price: exitPrice,
    exit_reason: exitReason,
    exit_at: evalResult.exitAt ? new Date(evalResult.exitAt).toISOString() : null,
    breakeven_activated: evalResult.breakevenActivated ?? false,
    final_stop_price: evalResult.finalStopPrice ?? null,
    outcome: finalOutcome,
    status: finished ? "COMPLETED" : "PENDING",
    evaluation_ended_at: finished ? new Date(nowMs).toISOString() : null,
    next_check_at: finished ? null : nextCheckAt({ timeframe: prediction.timeframe, nowMs, horizonEnd }),
  });

  if (finished) await updatePredictionStatus(prediction.id, "COMPLETED");
  return finalOutcome;
}

async function runWorker(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const url = new URL(request.url);
  const limit = Math.min(
    Number(url.searchParams.get("limit") || OUTCOME_CONFIG.WORKER_BATCH_LIMIT),
    OUTCOME_CONFIG.WORKER_BATCH_LIMIT
  );

  let queue;
  try {
    queue = await buildQueue(startedAt, limit);
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  const results = [];
  let timedOut = false;

  for (const item of queue) {
    // Berhenti sendiri sebelum Vercel memutus request. Sisa antrean dikerjakan
    // di jalannya berikutnya karena urutannya "paling telat dulu".
    if (Date.now() - startedAt > OUTCOME_CONFIG.WORKER_DEADLINE_MS) {
      timedOut = true;
      break;
    }
    try {
      const outcome = await evaluateOne(item.prediction, item.outcome, Date.now());
      results.push({ id: item.prediction.id, outcome });
    } catch (err) {
      results.push({ id: item.prediction.id, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    queued: queue.length,
    processed: results.length,
    remaining: queue.length - results.length,
    timedOut,
    durationMs: Date.now() - startedAt,
    results,
  });
}

export async function GET(request) { return runWorker(request); }
export async function POST(request) { return runWorker(request); }

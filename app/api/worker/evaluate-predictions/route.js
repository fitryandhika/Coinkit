import { NextResponse } from "next/server";
import { listDuePredictions, updatePredictionStatus } from "@/lib/db/predictions";
import { getOutcome, initOutcome, updateOutcome } from "@/lib/db/outcomes";
import { getSnapshot } from "@/lib/db/snapshots";
import { evaluateOutcome, fetchOutcomeCandles } from "@/lib/outcome/monitor";
import { evaluateTrailingOutcome } from "@/lib/outcome/trailingMonitor";
import { evaluateWaitOutcome } from "@/lib/outcome/waitEvaluation";
import { isExpired, nextCheckAt, isDueForCheck } from "@/lib/outcome/scheduler";
import { OUTCOME_CONFIG } from "@/lib/outcome/config";

export const maxDuration = 30;

function checkAuth(request) {
  const authHeader = request.headers.get("authorization");
  const vercelCronSecret = process.env.CRON_SECRET;
  if (vercelCronSecret && authHeader === `Bearer ${vercelCronSecret}`) return true;

  const url = new URL(request.url);
  const workerSecret = process.env.WORKER_SECRET;
  if (workerSecret && url.searchParams.get("secret") === workerSecret) return true;

  return false;
}

async function runWorker(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const nowMs = Date.now();
  const due = await listDuePredictions({ limit: OUTCOME_CONFIG.WORKER_BATCH_LIMIT });
  const results = [];

  for (const prediction of due) {
    try {
      const existingOutcome = await getOutcome(prediction.id);
      if (existingOutcome && !isDueForCheck({ nextCheckAtIso: existingOutcome.next_check_at, nowMs })) {
        results.push({ id: prediction.id, skipped: "not_due" });
        continue;
      }
      if (!existingOutcome) {
        await initOutcome(prediction.id, { startedAt: prediction.timestamp, nextCheckAt: nextCheckAt({ timeframe: prediction.timeframe, nowMs }) });
      }

      if (prediction.decision === "SELL") {
        await updateOutcome(prediction.id, { status: "COMPLETED", outcome: "NOT_APPLICABLE", evaluation_ended_at: new Date(nowMs).toISOString() });
        await updatePredictionStatus(prediction.id, "COMPLETED");
        results.push({ id: prediction.id, outcome: "NOT_APPLICABLE" });
        continue;
      }

      const expired = isExpired({ timestamp: prediction.timestamp, evaluationHorizon: prediction.evaluation_horizon, nowMs });
      const entryTimestamp = new Date(prediction.timestamp).getTime();
      const candles = await fetchOutcomeCandles({ market: prediction.market, symbol: prediction.symbol, entryTimestamp, nowMs });

      if (prediction.decision === "WAIT") {
        const snapshot = await getSnapshot(prediction.id);
        const evalResult = evaluateWaitOutcome({ referencePrice: snapshot?.price ?? null, candles });
        const finished = expired || evalResult.evaluation !== "PENDING";
        await updateOutcome(prediction.id, {
          maximum_gain_pct: evalResult.maximumMovePct,
          outcome: evalResult.evaluation,
          status: finished ? "COMPLETED" : "PENDING",
          evaluation_ended_at: finished ? new Date(nowMs).toISOString() : null,
          next_check_at: finished ? null : nextCheckAt({ timeframe: prediction.timeframe, nowMs }),
        });
        if (finished) await updatePredictionStatus(prediction.id, "COMPLETED");
        results.push({ id: prediction.id, outcome: evalResult.evaluation });
        continue;
      }

      // Prediction lama (dibuat sebelum fitur trailing SL) tidak punya trail_atr —
      // fallback otomatis ke evaluateOutcome() lama (SL/TP tetap), tidak diubah sama sekali.
      const hasTrailing = prediction.trail_atr !== null && prediction.trail_atr !== undefined;
      const evalResult = hasTrailing
        ? evaluateTrailingOutcome({
            direction: prediction.decision, entry: prediction.entry, stopLoss: prediction.stop_loss,
            tp1: prediction.tp1, tp2: prediction.tp2, tp3: prediction.tp3,
            trailAtr: prediction.trail_atr, trailMultiplier: prediction.trail_multiplier, candles,
          })
        : evaluateOutcome({
            direction: prediction.decision, entry: prediction.entry, stopLoss: prediction.stop_loss,
            tp1: prediction.tp1, tp2: prediction.tp2, tp3: prediction.tp3, candles,
          });

      const finished = evalResult.outcome !== "PENDING" || expired;
      const finalOutcome = evalResult.outcome !== "PENDING" ? evalResult.outcome : expired ? "EXPIRED" : "PENDING";

      // Setup yang EXPIRED tanpa menyentuh SL/TP dulu tidak pernah menyimpan harga
      // keluar, sehingga hasil nyatanya mustahil dihitung dan setup itu hilang dari
      // kalibrasi. Sekarang harga close candle terakhir dipakai sebagai harga keluar.
      const lastClose = candles.length ? candles[candles.length - 1].close : null;
      const resolvedExitPrice =
        evalResult.exitPrice ?? (finalOutcome === "EXPIRED" && Number.isFinite(lastClose) ? lastClose : null);

      await updateOutcome(prediction.id, {
        maximum_gain_pct: evalResult.maximumGainPct,
        maximum_drawdown_pct: evalResult.maximumDrawdownPct,
        maximum_gain_price: evalResult.maximumGainPrice,
        maximum_drawdown_price: evalResult.maximumDrawdownPrice,
        maximum_r: evalResult.maximumR,
        tp1_hit: evalResult.tp1Hit, tp2_hit: evalResult.tp2Hit, tp3_hit: evalResult.tp3Hit, sl_hit: evalResult.slHit,
        tp1_hit_at: evalResult.tp1HitAt ? new Date(evalResult.tp1HitAt).toISOString() : null,
        tp2_hit_at: evalResult.tp2HitAt ? new Date(evalResult.tp2HitAt).toISOString() : null,
        tp3_hit_at: evalResult.tp3HitAt ? new Date(evalResult.tp3HitAt).toISOString() : null,
        sl_hit_at: evalResult.slHitAt ? new Date(evalResult.slHitAt).toISOString() : null,
        exit_price: resolvedExitPrice,
        breakeven_activated: evalResult.breakevenActivated ?? false,
        final_stop_price: evalResult.finalStopPrice ?? null,
        outcome: finalOutcome,
        status: finished ? "COMPLETED" : "PENDING",
        evaluation_ended_at: finished ? new Date(nowMs).toISOString() : null,
        next_check_at: finished ? null : nextCheckAt({ timeframe: prediction.timeframe, nowMs }),
      });

      if (finished) await updatePredictionStatus(prediction.id, "COMPLETED");
      results.push({ id: prediction.id, outcome: finalOutcome });
    } catch (err) {
      results.push({ id: prediction.id, error: err.message });
    }
  }

  return NextResponse.json({ success: true, processed: results.length, results });
}

export async function GET(request) { return runWorker(request); }
export async function POST(request) { return runWorker(request); }

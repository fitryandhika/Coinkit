import { NextResponse } from "next/server";
import { createPrediction, listPredictions } from "@/lib/db/predictions";
import { createSnapshot } from "@/lib/db/snapshots";
import { initOutcome } from "@/lib/db/outcomes";
import { nextCheckAt } from "@/lib/outcome/scheduler";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 }); }

  const { symbol, market, timeframe, decision, score, confidence, tradePlan, snapshot, reasoning, evaluationHorizon } = body || {};
  if (!symbol || !market || !decision) {
    return NextResponse.json({ success: false, error: "symbol, market, decision wajib diisi" }, { status: 400 });
  }

  try {
    const id = await createPrediction({
      symbol, market, timeframe: timeframe || "1h", decision, score, confidence,
      entry: tradePlan?.entry?.price ?? null,
      stopLoss: tradePlan?.stopLoss?.price ?? null,
      tp1: tradePlan?.takeProfit?.tp1 ?? null,
      tp2: tradePlan?.takeProfit?.tp2 ?? null,
      tp3: tradePlan?.takeProfit?.tp3 ?? null,
      riskPercent: tradePlan?.risk?.percent ?? null,
      riskAmount: tradePlan?.risk?.amount ?? null,
      positionSize: tradePlan?.positionSize ?? null,
      leverage: tradePlan?.leverage ?? null,
      riskReward: tradePlan?.riskReward?.tp1 ?? null,
      riskScore: tradePlan?.riskScore ?? null,
      evaluationHorizon: evaluationHorizon || "24H",
      reasoning: reasoning || null,
    });

    if (snapshot) await createSnapshot(id, snapshot);
    await initOutcome(id, { startedAt: new Date().toISOString(), nextCheckAt: nextCheckAt({ timeframe: timeframe || "1h", nowMs: Date.now() }) });

    return NextResponse.json({ success: true, predictionId: id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || undefined;
  const decision = searchParams.get("decision") || undefined;
  const status = searchParams.get("status") || undefined;
  const limit = Number(searchParams.get("limit") || 50);

  try {
    const predictions = await listPredictions({ symbol, decision, status, limit });
    return NextResponse.json({ success: true, predictions });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

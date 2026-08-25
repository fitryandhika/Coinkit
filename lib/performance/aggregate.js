import { listOutcomes } from "@/lib/db/outcomes";
import { getSupabaseClient } from "@/lib/db/supabaseClient";

function average(values) {
  const valid = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Number((valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(4));
}

function groupBy(rows, keyFn) {
  const map = {};
  rows.forEach((row) => {
    const key = keyFn(row) || "UNKNOWN";
    if (!map[key]) map[key] = [];
    map[key].push(row);
  });
  return map;
}

function inferSetupType(prediction) {
  if (prediction.breakout_status === "BREAKOUT" || prediction.breakout_status === "ABOVE_RESISTANCE") return "BREAKOUT";
  if (prediction.market_structure === "BULLISH_STRUCTURE" || prediction.market_structure === "BEARISH_STRUCTURE") return "TREND_CONTINUATION";
  return "UNKNOWN";
}

function summarize(rows) {
  const completed = rows.filter((r) => r.status === "COMPLETED");
  const tpHits = completed.filter((r) => ["TP1_HIT", "TP2_HIT", "TP3_HIT"].includes(r.outcome)).length;
  const slHits = completed.filter((r) => r.outcome === "SL_HIT").length;

  return {
    totalPredictions: rows.length,
    completed: completed.length,
    pending: rows.length - completed.length,
    tpHitRate: completed.length ? Number(((tpHits / completed.length) * 100).toFixed(2)) : null,
    slHitRate: completed.length ? Number(((slHits / completed.length) * 100).toFixed(2)) : null,
    averageMaxGainPct: average(completed.map((r) => r.maximum_gain_pct)),
    averageMaxDrawdownPct: average(completed.map((r) => r.maximum_drawdown_pct)),
    averageR: average(completed.map((r) => r.maximum_r)),
  };
}

export async function buildPerformanceReport() {
  const rows = await listOutcomes({ limit: 500 });
  const predictionIds = rows.map((r) => r.prediction_id);

  const supabase = getSupabaseClient();
  const { data: snapshots } = await supabase.from("prediction_snapshots").select("*").in("prediction_id", predictionIds.length ? predictionIds : ["__none__"]);
  const snapshotMap = new Map((snapshots || []).map((s) => [s.prediction_id, s]));

  const predictions = rows.map((r) => {
    const snap = snapshotMap.get(r.prediction_id);
    return {
      ...r.ai_predictions,
      outcome: r.outcome, status: r.status,
      maximum_gain_pct: r.maximum_gain_pct, maximum_drawdown_pct: r.maximum_drawdown_pct, maximum_r: r.maximum_r,
      breakout_status: snap?.breakout_status ?? null,
      market_structure: snap?.market_structure ?? null,
      market_regime: snap?.market_regime ?? null,
      technical_score: snap?.technical_score ?? null,
    };
  });

  const overall = summarize(predictions);
  const decisionCounts = Object.fromEntries(Object.entries(groupBy(predictions, (p) => p.decision)).map(([k, v]) => [k, v.length]));

  const setupPerformance = Object.fromEntries(Object.entries(groupBy(predictions, inferSetupType)).map(([k, v]) => [k, summarize(v)]));
  const timeframePerformance = Object.fromEntries(Object.entries(groupBy(predictions, (p) => p.timeframe)).map(([k, v]) => [k, summarize(v)]));
  const regimePerformance = Object.fromEntries(Object.entries(groupBy(predictions, (p) => p.market_regime)).map(([k, v]) => [k, summarize(v)]));

  const scoreBuckets = { "50-59": [], "60-69": [], "70-79": [], "80-89": [], "90-100": [] };
  predictions.forEach((p) => {
    if (p.score === null || p.score === undefined) return;
    if (p.score < 60) scoreBuckets["50-59"].push(p);
    else if (p.score < 70) scoreBuckets["60-69"].push(p);
    else if (p.score < 80) scoreBuckets["70-79"].push(p);
    else if (p.score < 90) scoreBuckets["80-89"].push(p);
    else scoreBuckets["90-100"].push(p);
  });
  const scoreCalibration = Object.fromEntries(Object.entries(scoreBuckets).map(([b, r]) => [b, { count: r.length, averageMaxGainPct: average(r.map((x) => x.maximum_gain_pct)) }]));

  const confidenceBuckets = { "0-49": [], "50-64": [], "65-79": [], "80-100": [] };
  predictions.forEach((p) => {
    if (p.confidence === null || p.confidence === undefined) return;
    if (p.confidence < 50) confidenceBuckets["0-49"].push(p);
    else if (p.confidence < 65) confidenceBuckets["50-64"].push(p);
    else if (p.confidence < 80) confidenceBuckets["65-79"].push(p);
    else confidenceBuckets["80-100"].push(p);
  });
  const confidenceCalibration = Object.fromEntries(Object.entries(confidenceBuckets).map(([b, r]) => [b, { count: r.length, averageMaxGainPct: average(r.map((x) => x.maximum_gain_pct)) }]));

  const directional = predictions.filter((p) => ["LONG", "SHORT", "BUY"].includes(p.decision));
  const captured = directional.filter((p) => (p.maximum_gain_pct ?? 0) > 0).length;
  const opportunityCaptureRate = directional.length ? Number(((captured / directional.length) * 100).toFixed(2)) : null;

  const minSample = 3;
  const bestSetup = Object.entries(setupPerformance).filter(([, v]) => v.completed >= minSample).sort((a, b) => (b[1].averageR ?? -Infinity) - (a[1].averageR ?? -Infinity))[0]?.[0] ?? null;
  const worstSetup = Object.entries(setupPerformance).filter(([, v]) => v.completed >= minSample).sort((a, b) => (a[1].averageR ?? Infinity) - (b[1].averageR ?? Infinity))[0]?.[0] ?? null;
  const bestTimeframe = Object.entries(timeframePerformance).filter(([, v]) => v.completed >= minSample).sort((a, b) => (b[1].averageR ?? -Infinity) - (a[1].averageR ?? -Infinity))[0]?.[0] ?? null;

  const scatterData = predictions.map((p) => ({
    score: p.score, confidence: p.confidence, technicalScore: p.technical_score, riskScore: p.risk_score,
    maxGain: p.maximum_gain_pct, maxDrawdown: p.maximum_drawdown_pct,
  }));

  return {
    overall, decisionCounts, setupPerformance, timeframePerformance, regimePerformance,
    scoreCalibration, confidenceCalibration, opportunityCaptureRate,
    bestSetup, worstSetup, bestTimeframe, scatterData,
    insufficientData: overall.totalPredictions < 20,
  };
}

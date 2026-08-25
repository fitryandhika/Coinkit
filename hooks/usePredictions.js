"use client";

import { useState, useEffect, useCallback } from "react";

export function usePredictions({ limit = 50 } = {}) {
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions?limit=${limit}`);
      const json = await res.json();
      if (json.success) setRecords(json.predictions);
    } catch (err) {
      // biarkan list lama tetap tampil kalau refresh gagal
    } finally {
      setLoaded(true);
    }
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);

  const addPrediction = useCallback(async (decisionResult) => {
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: decisionResult.symbol,
        market: decisionResult.market,
        timeframe: decisionResult.timeframe,
        decision: decisionResult.decision,
        score: decisionResult.aiScore,
        confidence: decisionResult.confidence,
        tradePlan: decisionResult.tradePlan,
        snapshot: decisionResult.snapshot,
        reasoning: decisionResult.reasoning,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Gagal menyimpan prediction");
    await refresh();
    return json.predictionId;
  }, [refresh]);

  const markAction = useCallback(async (predictionId, action) => {
    await fetch(`/api/predictions/${predictionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await refresh();
  }, [refresh]);

  const saveManualTrade = useCallback(async (predictionId, journalData) => {
    await fetch("/api/manual-trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predictionId, ...journalData }),
    });
    await markAction(predictionId, "TAKEN");
  }, [markAction]);

  return { records, loaded, refresh, addPrediction, markAction, saveManualTrade };
}

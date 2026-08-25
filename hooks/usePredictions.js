"use client";

import { useState, useEffect, useCallback } from "react";

/** Prediction sekarang dicatat otomatis server-side oleh Screener (bukan lagi
 * dibuat lewat form di UI) — hook ini hanya untuk membaca & menandai TAKEN/SKIPPED. */
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

  return { records, loaded, refresh, markAction, saveManualTrade };
}

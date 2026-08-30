"use client";

import { useState, useEffect, useCallback } from "react";

/** Prediction dicatat otomatis server-side oleh Screener. Hook ini murni baca —
 * tidak ada lagi pencatatan trade manual; fokus aplikasi sekarang adalah
 * membandingkan prediksi screener dengan pergerakan market yang sesungguhnya. */
export function usePredictions({ limit = 50, includeControl = false } = {}) {
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions?limit=${limit}&includeControl=${includeControl ? "1" : "0"}`);
      const json = await res.json();
      if (json.success) setRecords(json.predictions);
    } catch (err) {
      // biarkan list lama tetap tampil kalau refresh gagal
    } finally {
      setLoaded(true);
    }
  }, [limit, includeControl]);

  useEffect(() => { refresh(); }, [refresh]);

  return { records, loaded, refresh };
}

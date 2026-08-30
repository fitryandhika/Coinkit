"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import TimeframeSelector from "@/components/screener/TimeframeSelector";
import ScreenerFilters from "@/components/screener/ScreenerFilters";
import ScreenerCard from "@/components/screener/ScreenerCard";
import { TIMEFRAMES } from "@/lib/bitget/constants";
import {
  DEFAULT_SCREENER_FILTERS,
  SORT_MODES,
  applyScreenerFilters,
  sortScreenerResults,
} from "@/lib/screener/clientFilters";

const POLL_INTERVAL_MS = 20000;
const DEFAULT_FILTERS = DEFAULT_SCREENER_FILTERS;

export default function ScreenerPage() {
  const [mode, setMode] = useState("spot");
  const [timeframe, setTimeframe] = useState("1h");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState("entryAdjustedScore");

  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const abortRef = useRef(null);
  const isFetchingRef = useRef(false);

  const loadScreener = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    isFetchingRef.current = true;

    try {
      const res = await fetch(`/api/screener?mode=${mode}&timeframe=${timeframe}`, { signal: controller.signal });
      const json = await res.json();
      if (json.success) {
        setResults(json.results || []);
        setStatus("rest-connected");
        setLastUpdate(Date.now());
        setErrorMessage(null);
      } else {
        setStatus("error");
        setErrorMessage(json.error || "Market data temporarily unavailable.");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setStatus("error");
        setErrorMessage("Market data temporarily unavailable.");
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [mode, timeframe]);

  useEffect(() => {
    setStatus("connecting");
    loadScreener();
    const interval = setInterval(loadScreener, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadScreener]);

  const { filteredResults, hiddenCount } = useMemo(() => {
    const kept = applyScreenerFilters(results, filters);
    return {
      filteredResults: sortScreenerResults(kept, sortKey, "desc"),
      hiddenCount: results.length - kept.length,
    };
  }, [results, filters, sortKey]);

  return (
    <>
      <Topbar title="Screener" mode={mode} onModeChange={setMode} connectionStatus={status} lastUpdate={lastUpdate} />

      <TimeframeSelector timeframe={timeframe} onChange={setTimeframe} options={TIMEFRAMES} />

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="panel-card">
        <ScreenerFilters filters={filters} onChange={setFilters} />
        <div className="filter-bar" style={{ marginTop: 8 }}>
          <div className="filter-field">
            <label>Urutkan</label>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
              {SORT_MODES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        {hiddenCount > 0 ? (
          <p className="detail-sub" style={{ marginTop: 8, marginBottom: 0 }}>
            {hiddenCount} coin disembunyikan karena harganya sudah lewat zona entry yang wajar.
            Ubah filter &quot;Kualitas Entry&quot; kalau tetap ingin melihatnya.
          </p>
        ) : null}
      </div>

      <div className="screener-card-list">
        {filteredResults.length === 0 ? (
          <p className="detail-sub">Tidak ada coin yang cocok dengan filter saat ini.</p>
        ) : (
          filteredResults.map((entry) => <ScreenerCard key={entry.symbol} entry={entry} mode={mode} />)
        )}
      </div>

      <p className="detail-sub" style={{ marginTop: 16 }}>
        Daftar diurutkan berdasarkan kombinasi kekuatan setup dan kelayakan harga saat ini, jadi coin yang
        sudah terlanjur melambung turun peringkatnya sendiri. Setup dengan score ≥ 60 yang harganya belum
        kemahalan otomatis dicatat sebagai riwayat untuk dibandingkan dengan pergerakan market sesungguhnya —
        lihat hasilnya di menu Screener History.
      </p>
    </>
  );
}

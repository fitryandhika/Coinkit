"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import TimeframeSelector from "@/components/screener/TimeframeSelector";
import ScreenerFilters from "@/components/screener/ScreenerFilters";
import ScreenerCard from "@/components/screener/ScreenerCard";
import { TIMEFRAMES } from "@/lib/bitget/constants";

const POLL_INTERVAL_MS = 20000;
const DEFAULT_FILTERS = { minScore: 0, minVolume: 0, minLiquidity: "ANY", maxSpread: null };

export default function ScreenerPage() {
  const [mode, setMode] = useState("spot");
  const [timeframe, setTimeframe] = useState("1h");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

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

  const filteredResults = useMemo(() => {
    const liquidityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, UNKNOWN: -1 };
    return results
      .filter((r) => {
        if ((r.screenerScore ?? -1) < filters.minScore) return false;
        if ((r.volume24h ?? 0) < filters.minVolume) return false;
        if (filters.minLiquidity !== "ANY") {
          const rank = liquidityOrder[r.liquidityLabel] ?? -1;
          const minRank = liquidityOrder[filters.minLiquidity] ?? 0;
          if (rank < minRank) return false;
        }
        if (filters.maxSpread !== null && r.spreadPct !== null && r.spreadPct > filters.maxSpread) return false;
        return true;
      })
      .sort((a, b) => (b.screenerScore ?? -1) - (a.screenerScore ?? -1));
  }, [results, filters]);

  return (
    <>
      <Topbar title="Screener" mode={mode} onModeChange={setMode} connectionStatus={status} lastUpdate={lastUpdate} />

      <TimeframeSelector timeframe={timeframe} onChange={setTimeframe} options={TIMEFRAMES} />

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="panel-card">
        <ScreenerFilters filters={filters} onChange={setFilters} />
      </div>

      <div className="screener-card-list">
        {filteredResults.length === 0 ? (
          <p className="detail-sub">Tidak ada coin yang cocok dengan filter saat ini.</p>
        ) : (
          filteredResults.map((entry) => <ScreenerCard key={entry.symbol} entry={entry} mode={mode} />)
        )}
      </div>

      <p className="detail-sub" style={{ marginTop: 16 }}>
        Setup dengan score ≥ 60 otomatis dicatat sebagai riwayat untuk dibandingkan dengan pergerakan market
        sesungguhnya — lihat hasilnya di menu Screener History.
      </p>
    </>
  );
}

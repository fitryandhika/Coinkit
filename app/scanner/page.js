"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import MarketTable from "@/components/MarketTable";
import TechnicalReportPanel from "@/components/technical/TechnicalReportPanel";

const POLL_INTERVAL_MS = 8000;

export default function ScannerPage() {
  const [mode, setMode] = useState("spot");
  const [tickers, setTickers] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [minVolume, setMinVolume] = useState(0);
  const [sortKey, setSortKey] = useState("volume24h");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  const abortRef = useRef(null);
  const isFetchingRef = useRef(false);

  const loadTickers = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    isFetchingRef.current = true;

    try {
      const res = await fetch(`/api/market/ticker?mode=${mode}`, { signal: controller.signal });
      const json = await res.json();
      if (json.success) {
        setTickers(json.tickers || []);
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
  }, [mode]);

  useEffect(() => {
    setStatus("connecting");
    setSelectedSymbol(null);
    loadTickers();
    const interval = setInterval(loadTickers, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadTickers]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const visibleTickers = useMemo(() => {
    const filtered = tickers.filter((t) => (t.volume24h ?? 0) >= minVolume);
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      const diff = av - bv;
      return sortDir === "asc" ? diff : -diff;
    });
  }, [tickers, minVolume, sortKey, sortDir]);

  return (
    <>
      <Topbar title="Scanner" mode={mode} onModeChange={setMode} connectionStatus={status} lastUpdate={lastUpdate} showSearch={false} />

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="panel-card">
        <div className="filter-bar">
          <label htmlFor="minVolume">Min. Volume (quote)</label>
          <input id="minVolume" type="number" min="0" value={minVolume} onChange={(e) => setMinVolume(Number(e.target.value) || 0)} />
        </div>

        <MarketTable tickers={visibleTickers} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onSelect={setSelectedSymbol} />
      </div>

      {selectedSymbol ? (
        <TechnicalReportPanel symbol={selectedSymbol} market={mode} onClose={() => setSelectedSymbol(null)} />
      ) : null}
    </>
  );
}

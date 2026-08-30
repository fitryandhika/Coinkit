"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import TimeframeSelector from "@/components/screener/TimeframeSelector";
import TopCountSelector from "@/components/screener/TopCountSelector";
import ScreenerFilters from "@/components/screener/ScreenerFilters";
import OpportunityTable from "@/components/screener/OpportunityTable";
import OpportunityDetail from "@/components/screener/OpportunityDetail";
import { TIMEFRAMES } from "@/lib/bitget/constants";
import {
  DEFAULT_SCREENER_FILTERS,
  applyScreenerFilters,
  sortScreenerResults,
} from "@/lib/screener/clientFilters";

const POLL_INTERVAL_MS = 20000;
const DEFAULT_FILTERS = DEFAULT_SCREENER_FILTERS;

export default function OpportunitiesPage() {
  const [mode, setMode] = useState("spot");
  const [timeframe, setTimeframe] = useState("1h");
  const [topCount, setTopCount] = useState(10);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState("entryAdjustedScore");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedSymbol, setSelectedSymbol] = useState(null);

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
    setSelectedSymbol(null);
    loadScreener();
    const interval = setInterval(loadScreener, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadScreener]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filteredResults = useMemo(
    () => sortScreenerResults(applyScreenerFilters(results, filters), sortKey, sortDir).slice(0, topCount),
    [results, filters, sortKey, sortDir, topCount]
  );

  const selected = results.find((r) => r.symbol === selectedSymbol) || null;

  return (
    <>
      <Topbar title="Top Opportunities" mode={mode} onModeChange={setMode} connectionStatus={status} lastUpdate={lastUpdate} />

      <div className="opportunities-controls-row">
        <TimeframeSelector timeframe={timeframe} onChange={setTimeframe} options={TIMEFRAMES} />
        <TopCountSelector topCount={topCount} onChange={setTopCount} />
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="panel-card">
        <ScreenerFilters filters={filters} onChange={setFilters} />
        <OpportunityTable
          results={filteredResults}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onSelect={setSelectedSymbol}
        />
      </div>

      {selected ? (
        <OpportunityDetail entry={selected} mode={mode} onClose={() => setSelectedSymbol(null)} />
      ) : null}
    </>
  );
}

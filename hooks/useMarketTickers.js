"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useBitgetSocket } from "./useBitgetSocket";
import { normalizeTicker } from "@/lib/bitget/parser";

const REST_POLL_INTERVAL_MS = 5000;

export function useMarketTickers(mode, symbols) {
  const { status: wsStatus, tickers: wsRawTickers, lastMessageAt } = useBitgetSocket(mode, symbols);

  const [restTickers, setRestTickers] = useState({});
  const [restUpdatedAt, setRestUpdatedAt] = useState(null);
  const [restError, setRestError] = useState(null);

  const abortRef = useRef(null);
  const isFetchingRef = useRef(false);

  const usingFallback = wsStatus === "reconnecting" || wsStatus === "failed";

  const fetchRest = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    isFetchingRef.current = true;

    try {
      const res = await fetch(`/api/market/ticker?mode=${mode}`, { signal: controller.signal });
      const json = await res.json();
      if (json.success) {
        const map = {};
        (json.tickers || []).forEach((t) => {
          if (t && t.symbol) map[t.symbol] = t;
        });
        setRestTickers(map);
        setRestUpdatedAt(Date.now());
        setRestError(null);
      } else {
        setRestError(json.error || "Market data temporarily unavailable.");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setRestError("Market data temporarily unavailable.");
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [mode]);

  useEffect(() => {
    if (!usingFallback) return undefined;
    fetchRest();
    const interval = setInterval(fetchRest, REST_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [usingFallback, fetchRest]);

  const tickers = {};
  symbols.forEach((symbol) => {
    if (usingFallback) {
      if (restTickers[symbol]) tickers[symbol] = restTickers[symbol];
    } else if (wsRawTickers[symbol]) {
      tickers[symbol] = normalizeTicker(wsRawTickers[symbol], mode);
    }
  });

  let connectionStatus = "connecting";
  if (usingFallback) {
    connectionStatus = restError ? "error" : "rest-fallback";
  } else if (wsStatus === "open") {
    connectionStatus = "ws-connected";
  }

  return {
    tickers,
    connectionStatus,
    lastUpdate: usingFallback ? restUpdatedAt : lastMessageAt,
    errorMessage: usingFallback ? restError : null,
  };
}

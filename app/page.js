"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import CandlestickChart from "@/components/charts/CandlestickChart";
import Sparkline from "@/components/charts/Sparkline";
import CoinIcon from "@/components/CoinIcon";
import TimeframeSelector from "@/components/screener/TimeframeSelector";
import { useMarketTickers } from "@/hooks/useMarketTickers";
import { TIMEFRAMES } from "@/lib/bitget/constants";

const WATCHLIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const CANDLE_POLL_MS = 15000;

export default function DashboardPage() {
  const [mode, setMode] = useState("spot");
  const [focusSymbol, setFocusSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("15m");
  const [candles, setCandles] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [performance, setPerformance] = useState(null);

  const { tickers, connectionStatus, lastUpdate } = useMarketTickers(mode, WATCHLIST);
  const abortRef = useRef(null);

  const loadCandles = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/market/candles?mode=${mode}&symbol=${focusSymbol}&timeframe=${timeframe}&limit=60`, { signal: controller.signal });
      const json = await res.json();
      if (json.success) setCandles(json.candles || []);
    } catch (err) {
      // biarkan chart lama tetap tampil kalau refresh gagal
    }
  }, [mode, focusSymbol, timeframe]);

  useEffect(() => {
    loadCandles();
    const interval = setInterval(loadCandles, CANDLE_POLL_MS);
    return () => { clearInterval(interval); if (abortRef.current) abortRef.current.abort(); };
  }, [loadCandles]);

  useEffect(() => {
    fetch(`/api/screener?mode=${mode}&timeframe=1h`)
      .then((res) => res.json())
      .then((json) => { if (json.success) setOpportunities((json.results || []).slice(0, 3)); })
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    fetch("/api/performance")
      .then((res) => res.json())
      .then((json) => { if (json.success) setPerformance(json); })
      .catch(() => {});
  }, []);

  const focusTicker = tickers[focusSymbol];
  const lastCandle = candles[candles.length - 1];
  const sparklineData = candles.map((c) => c.close).filter((v) => v !== null);

  return (
    <>
      <Topbar mode={mode} onModeChange={setMode} connectionStatus={connectionStatus} lastUpdate={lastUpdate} onSearchSymbol={setFocusSymbol} />

      <div className="dashboard-grid">
        <section className="panel-card hero-chart-card">
          <div className="hero-chart-header">
            <div>
              <h2>Performance</h2>
              <p className="ohlc-readout">
                {lastCandle ? (
                  <>
                    Open: <span className="ohlc-open">{lastCandle.open}</span>{" "}
                    High: <span className="ohlc-high">{lastCandle.high}</span>{" "}
                    Low: <span className="ohlc-low">{lastCandle.low}</span>{" "}
                    Close: <span className="ohlc-close">{lastCandle.close}</span>
                  </>
                ) : "Memuat data candle..."}
              </p>
            </div>
            <div className="hero-chart-controls">
              <span className="symbol-badge">{focusSymbol}</span>
              <TimeframeSelector timeframe={timeframe} onChange={setTimeframe} options={TIMEFRAMES} />
            </div>
          </div>
          <CandlestickChart candles={candles} height={260} />
        </section>

        <aside className="panel-card price-list-card">
          <h3>Today Crypto Price</h3>
          <p className="price-list-sub">Watchlist realtime dari Bitget {mode === "futures" ? "Futures" : "Spot"}. Klik untuk fokus chart.</p>
          <div className="price-list">
            {WATCHLIST.map((symbol) => {
              const t = tickers[symbol];
              const isUp = (t?.change24h ?? 0) >= 0;
              return (
                <button key={symbol} className="price-list-row" onClick={() => setFocusSymbol(symbol)}>
                  <CoinIcon symbol={symbol} size={22} />
                  <span className="price-list-symbol">{symbol.replace("USDT", "")}</span>
                  <span className="price-list-price">{t?.price ?? "—"}</span>
                  <span className={isUp ? "price-list-change up" : "price-list-change down"}>
                    {t?.change24h === null || t?.change24h === undefined ? "—" : `${isUp ? "+" : ""}${t.change24h.toFixed(2)}%`}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="panel-card stat-card">
          <div className="stat-card-header">
            <h4>Top Opportunities</h4>
            <Link href="/opportunities" className="stat-card-link">↗</Link>
          </div>
          {opportunities.length === 0 ? (
            <p className="detail-sub">Belum ada data screener.</p>
          ) : (
            <>
              <div className="stat-card-main">
                <span className="stat-card-symbol">{opportunities[0].symbol}</span>
                <span className="stat-card-score">{opportunities[0].screenerScore ?? "—"}</span>
              </div>
              <div className="stat-card-sub-row">
                {opportunities.slice(1, 3).map((o) => (
                  <div key={o.symbol} className="stat-card-chip">
                    <span>{o.symbol}</span>
                    <strong>{o.screenerScore ?? "—"}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="panel-card stat-card">
          <div className="stat-card-header">
            <h4>AI Performance</h4>
            <span className="stat-card-usd">since start</span>
          </div>
          {!performance || performance.insufficientData ? (
            <p className="detail-sub">Insufficient historical data for reliable performance conclusions.</p>
          ) : (
            <>
              <div className="stat-card-main">
                <span className="stat-card-value">{performance.overall.totalPredictions} predictions</span>
                <span className="stat-card-badge">{performance.overall.tpHitRate ?? "—"}% TP</span>
              </div>
              <div className="stat-card-sub-row">
                <div className="stat-card-chip"><span>Avg R</span><strong>{performance.overall.averageR ?? "—"}R</strong></div>
                <div className="stat-card-chip"><span>Avg Gain</span><strong>{performance.overall.averageMaxGainPct ?? "—"}%</strong></div>
              </div>
            </>
          )}
          <div className="stat-card-actions">
            <Link href="/assistant" className="stat-card-btn primary">Analyze</Link>
            <Link href="/risk" className="stat-card-btn">Risk Plan</Link>
          </div>
        </div>

        <div className="panel-card stat-card">
          <div className="stat-card-header">
            <h4>Market Pulse — {focusSymbol}</h4>
            {focusTicker ? (
              <span className={(focusTicker.change24h ?? 0) >= 0 ? "stat-card-badge up" : "stat-card-badge down"}>
                {(focusTicker.change24h ?? 0) >= 0 ? "+" : ""}{focusTicker.change24h?.toFixed(2) ?? "—"}%
              </span>
            ) : null}
          </div>
          <span className="stat-card-value big">{focusTicker?.price ?? "—"}</span>
          <Sparkline data={sparklineData} color={(focusTicker?.change24h ?? 0) >= 0 ? "#16c784" : "#ea3943"} />
        </div>
      </div>
    </>
  );
}

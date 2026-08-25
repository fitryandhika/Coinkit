"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import CandlestickChart from "@/components/charts/CandlestickChart";
import RSIChart from "@/components/charts/RSIChart";
import MACDChart from "@/components/charts/MACDChart";
import IndicatorTabRow from "@/components/dashboard/IndicatorTabRow";
import GlobalMarketCard from "@/components/dashboard/GlobalMarketCard";
import SymbolSearchBar from "@/components/dashboard/SymbolSearchBar";
import CoinIcon from "@/components/CoinIcon";
import { useMarketTickers } from "@/hooks/useMarketTickers";

const WATCHLIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const DASHBOARD_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];
const CANDLE_POLL_MS = 15000;

export default function DashboardPage() {
  const [mode, setMode] = useState("spot");
  const [focusSymbol, setFocusSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("15m");
  const [overlay, setOverlay] = useState("MA");
  const [subIndicator, setSubIndicator] = useState(null);
  const [candles, setCandles] = useState([]);
  const [opportunities, setOpportunities] = useState([]);

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

  const focusTicker = tickers[focusSymbol];
  const lastCandle = candles[candles.length - 1];
  const isUp = (focusTicker?.change24h ?? 0) >= 0;

  return (
    <>
      <Topbar mode={mode} onModeChange={setMode} connectionStatus={connectionStatus} lastUpdate={lastUpdate} />

      <SymbolSearchBar onSearch={setFocusSymbol} />

      <GlobalMarketCard />

      <div className="dashboard-grid">
        <section className="panel-card hero-chart-card ticker-card">
          <div className="ticker-card-header">
            <div>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CoinIcon symbol={focusSymbol} size={24} />
                {focusSymbol}
              </h2>
              <span className="ticker-card-sub">{mode === "futures" ? "Perpetual" : "Spot"}</span>
            </div>
            <div className="ticker-card-price">
              <span className="price-big">{focusTicker?.price ?? "—"}</span>
              <span className={isUp ? "change up" : "change down"}>
                {focusTicker?.change24h == null ? "—" : `${isUp ? "+" : ""}${focusTicker.change24h.toFixed(2)}%`}
              </span>
            </div>
          </div>

          <div className="ohlc-row">
            <div><span>Open</span><strong className="c-blue">{lastCandle?.open ?? "—"}</strong></div>
            <div><span>High</span><strong className="c-green">{lastCandle?.high ?? "—"}</strong></div>
            <div><span>Low</span><strong className="c-red">{lastCandle?.low ?? "—"}</strong></div>
            <div><span>Close</span><strong>{lastCandle?.close ?? "—"}</strong></div>
            <div><span>24H Vol</span><strong>{focusTicker?.volume24h != null ? focusTicker.volume24h.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</strong></div>
          </div>

          <div className="chip-group" style={{ margin: "10px 0" }}>
            {DASHBOARD_TIMEFRAMES.map((tf) => (
              <button key={tf} className={timeframe === tf ? "chip active" : "chip"} onClick={() => setTimeframe(tf)}>{tf}</button>
            ))}
          </div>

          <CandlestickChart candles={candles} height={260} overlay={overlay} />

          {subIndicator === "RSI" ? <RSIChart candles={candles} height={90} /> : null}
          {subIndicator === "MACD" ? <MACDChart candles={candles} height={90} /> : null}
          {subIndicator === "KDJ" ? (
            <p className="detail-sub" style={{ marginTop: 8 }}>Indikator KDJ belum tersedia — sedang dikembangkan.</p>
          ) : null}

          <IndicatorTabRow overlay={overlay} onOverlayChange={setOverlay} subIndicator={subIndicator} onSubChange={setSubIndicator} />
        </section>

        <aside className="panel-card price-list-card">
          <h3>Today Crypto Price</h3>
          <p className="price-list-sub">Watchlist realtime dari Bitget {mode === "futures" ? "Futures" : "Spot"}. Klik untuk fokus chart.</p>
          <div className="price-list">
            {WATCHLIST.map((symbol) => {
              const t = tickers[symbol];
              const symbolUp = (t?.change24h ?? 0) >= 0;
              return (
                <button key={symbol} className="price-list-row" onClick={() => setFocusSymbol(symbol)}>
                  <CoinIcon symbol={symbol} size={22} />
                  <span className="price-list-symbol">{symbol.replace("USDT", "")}</span>
                  <span className="price-list-price">{t?.price ?? "—"}</span>
                  <span className={symbolUp ? "price-list-change up" : "price-list-change down"}>
                    {t?.change24h == null ? "—" : `${symbolUp ? "+" : ""}${t.change24h.toFixed(2)}%`}
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
      </div>
    </>
  );
}

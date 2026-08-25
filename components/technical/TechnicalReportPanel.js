"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import CoinIcon from "@/components/CoinIcon";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

export default function TechnicalReportPanel({ symbol, market, onClose }) {
  const [timeframe, setTimeframe] = useState("1h");
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const abortRef = useRef(null);

  const loadReport = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");

    try {
      const res = await fetch(`/api/analysis/technical?symbol=${symbol}&market=${market}&timeframe=${timeframe}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (json.success) {
        setReport(json.data);
        setStatus("ok");
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
    }
  }, [symbol, market, timeframe]);

  useEffect(() => {
    loadReport();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadReport]);

  return (
    <div className="detail-panel technical-panel">
      <div className="detail-header">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CoinIcon symbol={symbol} size={20} />
          {symbol} · Technical Analysis
        </h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="chip-group">
        {TIMEFRAMES.map((tf) => (
          <button key={tf} className={timeframe === tf ? "chip active" : "chip"} onClick={() => setTimeframe(tf)}>
            {tf}
          </button>
        ))}
      </div>

      {status === "loading" ? <p className="detail-sub">Memuat analisis teknikal...</p> : null}
      {status === "error" ? <p className="error-banner">{errorMessage}</p> : null}

      {status === "ok" && report ? (
        report.dataQuality === "INSUFFICIENT_DATA" ? (
          <p className="error-banner">Data candle belum cukup untuk analisis teknikal timeframe ini.</p>
        ) : (
          <TechnicalReportBody report={report} />
        )
      ) : null}
    </div>
  );
}

function TechnicalReportBody({ report }) {
  return (
    <>
      <div className="detail-price">{formatNumber(report.price, { maximumFractionDigits: 8 })}</div>
      {report.dataQuality === "PARTIAL_DATA" ? (
        <p className="detail-sub">Sebagian indikator (mis. SMA200/ADX) belum tersedia — candle belum cukup.</p>
      ) : null}

      <h4 className="section-title">Trend</h4>
      <div className="detail-grid">
        <div><span>Short Term</span><strong>{report.trend.shortTerm}</strong></div>
        <div><span>Medium Term</span><strong>{report.trend.mediumTerm}</strong></div>
        <div><span>Long Term</span><strong>{report.trend.longTerm}</strong></div>
      </div>

      <h4 className="section-title">Indicators</h4>
      <div className="detail-grid">
        <div><span>RSI (14)</span><strong>{formatNumber(report.indicators.rsi, { maximumFractionDigits: 2 })} · {report.indicators.rsiLabel}</strong></div>
        <div><span>MACD</span><strong>{report.indicators.macd.state} ({report.indicators.macd.histogramTrend})</strong></div>
        <div><span>ADX (14)</span><strong>{formatNumber(report.indicators.adx, { maximumFractionDigits: 2 })} · {report.indicators.adxLabel}</strong></div>
        <div><span>ATR (14)</span><strong>{formatNumber(report.indicators.atrPercent, { maximumFractionDigits: 2 })}% · {report.indicators.atrLabel}</strong></div>
        <div><span>Bollinger</span><strong>{report.indicators.bollinger.position} ({formatNumber(report.indicators.bollinger.percentB, { maximumFractionDigits: 1 })}%B)</strong></div>
        <div><span>VWAP</span><strong>{formatNumber(report.indicators.vwap, { maximumFractionDigits: 8 })} · {report.indicators.vwapPosition}</strong></div>
      </div>

      <h4 className="section-title">Market Structure</h4>
      <div className="detail-grid">
        <div><span>Structure</span><strong>{report.structure.marketStructure}</strong></div>
        <div><span>Higher High</span><strong>{report.structure.higherHigh === null ? "—" : report.structure.higherHigh ? "Yes" : "No"}</strong></div>
        <div><span>Higher Low</span><strong>{report.structure.higherLow === null ? "—" : report.structure.higherLow ? "Yes" : "No"}</strong></div>
      </div>

      <h4 className="section-title">Support & Resistance</h4>
      <div className="detail-grid">
        <div><span>Support</span><strong>{report.support.length ? report.support.map((s) => formatNumber(s, { maximumFractionDigits: 8 })).join(", ") : "—"}</strong></div>
        <div><span>Resistance</span><strong>{report.resistance.length ? report.resistance.map((r) => formatNumber(r, { maximumFractionDigits: 8 })).join(", ") : "—"}</strong></div>
      </div>

      <h4 className="section-title">Breakout</h4>
      <p className="detail-sub">{report.breakout.status.replaceAll("_", " ")}</p>

      <h4 className="section-title">Multi Timeframe</h4>
      <div className="detail-grid">
        {Object.entries(report.multiTimeframe.byTimeframe).map(([tf, trend]) => (
          <div key={tf}><span>{tf}</span><strong>{trend}</strong></div>
        ))}
        <div><span>Alignment</span><strong>{report.multiTimeframe.alignment}</strong></div>
      </div>

      <div className="detail-score">
        <h4>Technical Score: {formatNumber(report.technicalScore, { maximumFractionDigits: 0 })}/100</h4>
        <p className="score-note">Ini bukan probability — hanya kualitas kondisi teknikal berdasarkan aturan yang sudah ditentukan.</p>
        <ul className="score-breakdown">
          <li>Trend: {formatNumber(report.scoreBreakdown.trendScore, { maximumFractionDigits: 0 })}</li>
          <li>Momentum: {formatNumber(report.scoreBreakdown.momentumScore, { maximumFractionDigits: 0 })}</li>
          <li>Volume: {formatNumber(report.scoreBreakdown.volumeScore, { maximumFractionDigits: 0 })}</li>
          <li>Volatility: {formatNumber(report.scoreBreakdown.volatilityScore, { maximumFractionDigits: 0 })}</li>
          <li>Structure: {formatNumber(report.scoreBreakdown.structureScore, { maximumFractionDigits: 0 })}</li>
        </ul>
      </div>

      {report.reasons?.length > 0 ? (
        <div className="detail-reasons"><h4>Reasons</h4><ul>{report.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
      ) : null}

      {report.conflicts?.length > 0 ? (
        <div className="detail-reasons"><h4>Conflicts</h4><ul>{report.conflicts.map((c) => <li key={c}>{c}</li>)}</ul></div>
      ) : null}

      <div className="chip-group" style={{ marginTop: 12 }}>
        <a className="chip" href={`/risk?symbol=${report.symbol}&market=${report.market}&entryPrice=${report.price ?? ""}`}>Buat Trade Plan →</a>
        <a className="chip" href={`/assistant?symbol=${report.symbol}&market=${report.market}`}>AI Trading Assistant →</a>
      </div>
    </>
  );
}

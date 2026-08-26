"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  TrendingUp, Activity, Layers, ArrowUpDown, LineChart, Repeat2,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import CandlestickChart from "@/components/charts/CandlestickChart";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

/** Ikon status kecil: hijau/naik utk bullish, merah/turun utk bearish, abu utk netral/unknown. */
function StatusIcon({ label }) {
  const bullish = ["BULLISH", "WEAK_BULLISH", "STRONG_UP", "MODERATE_UP", "BULLISH_MOMENTUM", "BULLISH_STRUCTURE", "ABOVE_VWAP", "BREAKOUT", "ABOVE_RESISTANCE"];
  const bearish = ["BEARISH", "WEAK_BEARISH", "STRONG_DOWN", "MODERATE_DOWN", "BEARISH_MOMENTUM", "BEARISH_STRUCTURE", "BELOW_VWAP", "FAILED_BREAKOUT", "BELOW_RESISTANCE"];

  if (bullish.includes(label)) return <ArrowUp size={12} className="status-icon status-icon-up" />;
  if (bearish.includes(label)) return <ArrowDown size={12} className="status-icon status-icon-down" />;
  return <Minus size={12} className="status-icon status-icon-neutral" />;
}

function DetailTile({ label, value, statusLabel }) {
  return (
    <div className="tech-detail-item">
      <span>{label}</span>
      <strong>
        {statusLabel ? <StatusIcon label={statusLabel} /> : null}
        {value}
      </strong>
    </div>
  );
}

export default function TechnicalReportPanel({ symbol, market, onClose }) {
  const [timeframe, setTimeframe] = useState("1h");
  const [report, setReport] = useState(null);
  const [candles, setCandles] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const abortRef = useRef(null);

  const loadReport = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");

    try {
      const [reportRes, candlesRes] = await Promise.all([
        fetch(`/api/analysis/technical?symbol=${symbol}&market=${market}&timeframe=${timeframe}`, { signal: controller.signal }),
        fetch(`/api/market/candles?mode=${market}&symbol=${symbol}&timeframe=${timeframe}&limit=80`, { signal: controller.signal }),
      ]);
      const reportJson = await reportRes.json();
      const candlesJson = await candlesRes.json();

      if (reportJson.success) {
        setReport(reportJson.data);
        setCandles(candlesJson.success ? candlesJson.candles || [] : []);
        setStatus("ok");
        setErrorMessage(null);
      } else {
        setStatus("error");
        setErrorMessage(reportJson.error || "Market data temporarily unavailable.");
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
          <TechnicalReportBody report={report} candles={candles} />
        )
      ) : null}
    </div>
  );
}

function SectionHeader({ icon: Icon, children }) {
  return (
    <h4 className="section-title tech-section-title">
      <Icon size={14} />
      {children}
    </h4>
  );
}

function TechnicalReportBody({ report, candles }) {
  const levels = [
    ...(report.support || []).map((p) => ({ price: p, color: "#16c784" })),
    ...(report.resistance || []).map((p) => ({ price: p, color: "#ea3943" })),
  ];

  return (
    <>
      <div className="detail-price">{formatNumber(report.price, { maximumFractionDigits: 8 })}</div>
      {report.dataQuality === "PARTIAL_DATA" ? (
        <p className="detail-sub">Sebagian indikator (mis. SMA200/ADX) belum tersedia — candle belum cukup.</p>
      ) : null}

      <CandlestickChart candles={candles} height={180} overlay="MA" levels={levels} visibleCount={60} showPriceAxis />
      <p className="chart-legend-note">
        <span className="legend-dot" style={{ background: "#16c784" }} />
        Support
        <span className="legend-dot" style={{ background: "#ea3943", marginLeft: 12 }} />
        Resistance
      </p>

      <SectionHeader icon={TrendingUp}>Trend</SectionHeader>
      <div className="tech-detail-grid">
        <DetailTile label="Short Term" value={report.trend.shortTerm} statusLabel={report.trend.shortTerm} />
        <DetailTile label="Medium Term" value={report.trend.mediumTerm} statusLabel={report.trend.mediumTerm} />
        <DetailTile label="Long Term" value={report.trend.longTerm} statusLabel={report.trend.longTerm} />
      </div>

      <SectionHeader icon={Activity}>Indicators</SectionHeader>
      <div className="tech-detail-grid">
        <DetailTile label="RSI (14)" value={`${formatNumber(report.indicators.rsi, { maximumFractionDigits: 2 })} · ${report.indicators.rsiLabel}`} />
        <DetailTile
          label="MACD"
          value={`${report.indicators.macd.state} (${report.indicators.macd.histogramTrend})`}
          statusLabel={report.indicators.macd.state}
        />
        <DetailTile label="ADX (14)" value={`${formatNumber(report.indicators.adx, { maximumFractionDigits: 2 })} · ${report.indicators.adxLabel}`} />
        <DetailTile label="ATR (14)" value={`${formatNumber(report.indicators.atrPercent, { maximumFractionDigits: 2 })}% · ${report.indicators.atrLabel}`} />
        <DetailTile label="Bollinger" value={`${report.indicators.bollinger.position} (${formatNumber(report.indicators.bollinger.percentB, { maximumFractionDigits: 1 })}%B)`} />
        <DetailTile
          label="VWAP"
          value={`${formatNumber(report.indicators.vwap, { maximumFractionDigits: 8 })} · ${report.indicators.vwapPosition}`}
          statusLabel={report.indicators.vwapPosition}
        />
      </div>

      <SectionHeader icon={Layers}>Market Structure</SectionHeader>
      <div className="tech-detail-grid">
        <DetailTile label="Structure" value={report.structure.marketStructure} statusLabel={report.structure.marketStructure} />
        <DetailTile label="Higher High" value={report.structure.higherHigh === null ? "—" : report.structure.higherHigh ? "Ya" : "Tidak"} />
        <DetailTile label="Higher Low" value={report.structure.higherLow === null ? "—" : report.structure.higherLow ? "Ya" : "Tidak"} />
      </div>

      <SectionHeader icon={ArrowUpDown}>Support &amp; Resistance</SectionHeader>
      <div className="tech-detail-grid">
        <DetailTile label="Support" value={report.support.length ? report.support.map((s) => formatNumber(s, { maximumFractionDigits: 8 })).join(", ") : "—"} />
        <DetailTile label="Resistance" value={report.resistance.length ? report.resistance.map((r) => formatNumber(r, { maximumFractionDigits: 8 })).join(", ") : "—"} />
      </div>

      <SectionHeader icon={LineChart}>Breakout</SectionHeader>
      <div className="tech-detail-grid">
        <DetailTile label="Status" value={report.breakout.status.replaceAll("_", " ")} statusLabel={report.breakout.status} />
      </div>

      <SectionHeader icon={Repeat2}>Multi Timeframe</SectionHeader>
      <div className="tech-detail-grid">
        {Object.entries(report.multiTimeframe.byTimeframe).map(([tf, trend]) => (
          <DetailTile key={tf} label={tf} value={trend} statusLabel={trend} />
        ))}
        <DetailTile label="Alignment" value={report.multiTimeframe.alignment} />
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
    </>
  );
}

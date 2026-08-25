"use client";

import { macd } from "@/lib/technical/indicators";

export default function MACDChart({ candles, height = 90, visibleCount }) {
  if (!candles || candles.length < 35) {
    return <div className="chart-empty" style={{ height }}>Data belum cukup untuk MACD.</div>;
  }

  const closesFull = candles.map((c) => c.close ?? 0);
  const { macdLine: macdLineFull, signalLine: signalLineFull, histogram: histogramFull } = macd(closesFull, 12, 26, 9);

  const startIndex = visibleCount && visibleCount < candles.length ? candles.length - visibleCount : 0;
  const visibleCandles = candles.slice(startIndex);
  const macdLine = macdLineFull.slice(startIndex);
  const signalLine = signalLineFull.slice(startIndex);
  const histogram = histogramFull.slice(startIndex);

  const width = 100;

  const validValues = [...histogram, ...macdLine, ...signalLine].filter((v) => v !== null);
  if (validValues.length === 0) {
    return <div className="chart-empty" style={{ height }}>Data belum cukup untuk MACD.</div>;
  }
  const maxAbs = Math.max(...validValues.map((v) => Math.abs(v)), 0.0001);

  const mid = height / 2;
  const yForValue = (v) => mid - (v / maxAbs) * mid * 0.9;
  const xForIndex = (i) => (i / (visibleCandles.length - 1)) * width;
  const barWidth = (width / visibleCandles.length) * 0.6;

  const macdPoints = macdLine.map((v, i) => (v === null ? null : `${xForIndex(i)},${yForValue(v)}`)).filter(Boolean).join(" ");
  const signalPoints = signalLine.map((v, i) => (v === null ? null : `${xForIndex(i)},${yForValue(v)}`)).filter(Boolean).join(" ");

  const lastMacd = [...macdLine].reverse().find((v) => v !== null);
  const lastSignal = [...signalLine].reverse().find((v) => v !== null);

  return (
    <div className="sub-chart-wrap">
      <div className="sub-chart-label">
        MACD: {lastMacd !== undefined ? lastMacd.toFixed(4) : "—"} · Signal: {lastSignal !== undefined ? lastSignal.toFixed(4) : "—"}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="sub-chart-svg" style={{ height }}>
        <line x1="0" y1={mid} x2={width} y2={mid} className="chart-refline" />
        {histogram.map((v, i) => {
          if (v === null) return null;
          const x = xForIndex(i);
          const y = v >= 0 ? yForValue(v) : mid;
          const h = Math.abs(yForValue(v) - mid);
          return <rect key={i} x={x - barWidth / 2} y={y} width={barWidth} height={Math.max(h, 0.3)} fill={v >= 0 ? "#16c784" : "#ea3943"} opacity="0.6" />;
        })}
        {macdPoints ? <polyline points={macdPoints} className="chart-ma-line" style={{ stroke: "#4f7cff" }} /> : null}
        {signalPoints ? <polyline points={signalPoints} className="chart-ma-line" style={{ stroke: "#f0b90b" }} /> : null}
      </svg>
    </div>
  );
}

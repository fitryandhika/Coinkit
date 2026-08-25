"use client";

import { rsi } from "@/lib/technical/indicators";

export default function RSIChart({ candles, height = 90 }) {
  if (!candles || candles.length < 15) {
    return <div className="chart-empty" style={{ height }}>Data belum cukup untuk RSI.</div>;
  }

  const closes = candles.map((c) => c.close ?? 0);
  const values = rsi(closes, 14);
  const width = 100;
  const yForValue = (v) => height - (v / 100) * height;
  const xForIndex = (i) => (i / (candles.length - 1)) * width;
  const points = values.map((v, i) => (v === null ? null : `${xForIndex(i)},${yForValue(v)}`)).filter(Boolean).join(" ");
  const lastValue = [...values].reverse().find((v) => v !== null);

  return (
    <div className="sub-chart-wrap">
      <div className="sub-chart-label">RSI (14): {lastValue !== undefined ? lastValue.toFixed(1) : "—"}</div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="sub-chart-svg" style={{ height }}>
        <line x1="0" y1={yForValue(70)} x2={width} y2={yForValue(70)} className="chart-refline" />
        <line x1="0" y1={yForValue(30)} x2={width} y2={yForValue(30)} className="chart-refline" />
        {points ? <polyline points={points} className="chart-ma-line" style={{ stroke: "#f0b90b" }} /> : null}
      </svg>
    </div>
  );
}

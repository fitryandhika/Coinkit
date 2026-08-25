"use client";

import { sma, ema, bollinger } from "@/lib/technical/indicators";

export default function CandlestickChart({ candles, height = 260, overlay = "MA", levels = [] }) {
  if (!candles || candles.length === 0) {
    return <div className="chart-empty" style={{ height }}>Memuat chart...</div>;
  }

  const highs = candles.map((c) => c.high).filter((v) => v !== null);
  const lows = candles.map((c) => c.low).filter((v) => v !== null);
  if (highs.length === 0 || lows.length === 0) {
    return <div className="chart-empty" style={{ height }}>Data candle tidak lengkap.</div>;
  }

  const width = 100;
  const padding = { top: 8, bottom: 4 };
  const volumeHeight = 28;
  const chartHeight = height - padding.top - padding.bottom;
  const priceHeight = chartHeight - volumeHeight;

  const closes = candles.map((c) => c.close ?? 0);
  const period = Math.min(20, candles.length);

  let overlayLines = [];
  if (overlay === "MA") {
    overlayLines = [{ color: "#f0b90b", values: sma(closes, period) }];
  } else if (overlay === "EMA") {
    overlayLines = [{ color: "#4f7cff", values: ema(closes, period) }];
  } else if (overlay === "BOLL") {
    const bands = bollinger(closes, period, 2);
    overlayLines = [
      { color: "#f0b90b", values: bands.upper },
      { color: "#6b7280", values: bands.middle },
      { color: "#f0b90b", values: bands.lower },
    ];
  }

  const overlayValuesFlat = overlayLines.flatMap((l) => l.values.filter((v) => v !== null));
  const levelValues = levels.map((l) => l.price).filter((v) => v !== null && v !== undefined);
  const maxPrice = Math.max(...highs, ...overlayValuesFlat, ...levelValues);
  const minPrice = Math.min(...lows, ...overlayValuesFlat, ...levelValues);
  const priceRange = maxPrice - minPrice || 1;

  const volumes = candles.map((c) => c.volume ?? 0);
  const maxVolume = Math.max(...volumes, 1);

  const candleWidth = width / candles.length;
  const bodyWidth = candleWidth * 0.6;

  const yForPrice = (price) => padding.top + ((maxPrice - price) / priceRange) * priceHeight;
  const xForIndex = (i) => i * candleWidth + candleWidth / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="candlestick-svg" style={{ height }}>
      <line x1="0" y1={yForPrice(maxPrice)} x2={width} y2={yForPrice(maxPrice)} className="chart-refline" />
      <line x1="0" y1={yForPrice(minPrice)} x2={width} y2={yForPrice(minPrice)} className="chart-refline" />

      {candles.map((c, i) => {
        if (c.open === null || c.close === null || c.high === null || c.low === null) return null;
        const isUp = c.close >= c.open;
        const x = xForIndex(i);
        const bodyTop = yForPrice(Math.max(c.open, c.close));
        const bodyBottom = yForPrice(Math.min(c.open, c.close));
        const vHeight = (volumes[i] / maxVolume) * volumeHeight;

        return (
          <g key={c.time}>
            <line x1={x} y1={yForPrice(c.high)} x2={x} y2={yForPrice(c.low)} className={isUp ? "candle-wick-up" : "candle-wick-down"} />
            <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={Math.max(bodyBottom - bodyTop, 0.3)} className={isUp ? "candle-body-up" : "candle-body-down"} />
            <rect x={x - bodyWidth / 2} y={padding.top + priceHeight + volumeHeight - vHeight} width={bodyWidth} height={vHeight} className={isUp ? "volume-bar-up" : "volume-bar-down"} />
          </g>
        );
      })}

      {overlayLines.map((line, idx) => {
        const points = line.values.map((v, i) => (v === null ? null : `${xForIndex(i)},${yForPrice(v)}`)).filter(Boolean).join(" ");
        return points ? <polyline key={`overlay-${idx}`} points={points} className="chart-ma-line" style={{ stroke: line.color }} /> : null;
      })}

      {levels.map((level, idx) => {
        if (level.price === null || level.price === undefined) return null;
        const y = yForPrice(level.price);
        return (
          <line
            key={`level-${idx}`}
            x1="0" y1={y} x2={width} y2={y}
            className="chart-level-line"
            style={{ stroke: level.color }}
          />
        );
      })}
    </svg>
  );
}

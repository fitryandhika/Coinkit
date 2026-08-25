"use client";

import { sma, ema, bollinger } from "@/lib/technical/indicators";

function formatAxisPrice(price) {
  if (price === null || price === undefined) return "";
  const digits = price < 1 ? 6 : price < 100 ? 4 : price < 10000 ? 2 : 0;
  return price.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/**
 * `candles` boleh berisi lebih banyak data dari yang ditampilkan (mis. 80 candle) —
 * kelebihan di depan dipakai sebagai "pemanasan" perhitungan MA/EMA/Bollinger supaya
 * garisnya penuh dari ujung ke ujung area yang terlihat, bukan cuma separuh.
 * `visibleCount` menentukan berapa candle TERAKHIR yang benar-benar digambar.
 */
export default function CandlestickChart({ candles, height = 260, overlay = "MA", levels = [], visibleCount, showPriceAxis = false }) {
  if (!candles || candles.length === 0) {
    return <div className="chart-empty" style={{ height }}>Memuat chart...</div>;
  }

  const closesFull = candles.map((c) => c.close ?? 0);
  const period = Math.min(20, candles.length);

  let overlayLinesFull = [];
  if (overlay === "MA") {
    overlayLinesFull = [{ color: "#f0b90b", values: sma(closesFull, period) }];
  } else if (overlay === "EMA") {
    overlayLinesFull = [{ color: "#4f7cff", values: ema(closesFull, period) }];
  } else if (overlay === "BOLL") {
    const bands = bollinger(closesFull, period, 2);
    overlayLinesFull = [
      { color: "#f0b90b", values: bands.upper },
      { color: "#6b7280", values: bands.middle },
      { color: "#f0b90b", values: bands.lower },
    ];
  }

  const startIndex = visibleCount && visibleCount < candles.length ? candles.length - visibleCount : 0;
  const visibleCandles = candles.slice(startIndex);
  const overlayLines = overlayLinesFull.map((line) => ({ ...line, values: line.values.slice(startIndex) }));

  const highs = visibleCandles.map((c) => c.high).filter((v) => v !== null);
  const lows = visibleCandles.map((c) => c.low).filter((v) => v !== null);
  if (highs.length === 0 || lows.length === 0) {
    return <div className="chart-empty" style={{ height }}>Data candle tidak lengkap.</div>;
  }

  const width = 100;
  const padding = { top: 8, bottom: 4 };
  const volumeHeight = 28;
  const chartHeight = height - padding.top - padding.bottom;
  const priceHeight = chartHeight - volumeHeight;

  const overlayValuesFlat = overlayLines.flatMap((l) => l.values.filter((v) => v !== null));
  const levelValues = levels.map((l) => l.price).filter((v) => v !== null && v !== undefined);
  const maxPrice = Math.max(...highs, ...overlayValuesFlat, ...levelValues);
  const minPrice = Math.min(...lows, ...overlayValuesFlat, ...levelValues);
  const priceRange = maxPrice - minPrice || 1;

  const volumes = visibleCandles.map((c) => c.volume ?? 0);
  const maxVolume = Math.max(...volumes, 1);

  const candleWidth = width / visibleCandles.length;
  const bodyWidth = candleWidth * 0.6;

  const yForPrice = (price) => padding.top + ((maxPrice - price) / priceRange) * priceHeight;
  const xForIndex = (i) => i * candleWidth + candleWidth / 2;

  // 5 titik grid harga (0/25/50/75/100% dari range) — dipakai untuk gridline DAN
  // label price axis, jadi posisinya selalu sinkron persis satu sama lain.
  const priceGridPoints = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const price = maxPrice - t * priceRange;
    return { top: yForPrice(price), price };
  });

  return (
    <div className="candlestick-chart-wrap" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="candlestick-svg" style={{ height }}>
        {priceGridPoints.map((p, idx) => (
          <line key={`grid-${idx}`} x1="0" y1={p.top} x2={width} y2={p.top} className="chart-refline" />
        ))}

        {visibleCandles.map((c, i) => {
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
            <line key={`level-${idx}`} x1="0" y1={y} x2={width} y2={y} className="chart-level-line" style={{ stroke: level.color }} />
          );
        })}
      </svg>

      {showPriceAxis ? (
        <div className="chart-price-axis" style={{ height }}>
          {priceGridPoints.map((p, idx) => (
            <span key={idx} className="chart-price-axis-label" style={{ top: `${p.top}px` }}>
              {formatAxisPrice(p.price)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

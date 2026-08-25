"use client";

function computeSMA(values, period) {
  const result = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const window = values.slice(i - period + 1, i + 1);
    result[i] = window.reduce((s, v) => s + v, 0) / period;
  }
  return result;
}

export default function CandlestickChart({ candles, height = 260, maPeriod = 20 }) {
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

  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const priceRange = maxPrice - minPrice || 1;

  const volumes = candles.map((c) => c.volume ?? 0);
  const maxVolume = Math.max(...volumes, 1);

  const closes = candles.map((c) => c.close ?? 0);
  const ma = computeSMA(closes, Math.min(maPeriod, candles.length));

  const candleWidth = width / candles.length;
  const bodyWidth = candleWidth * 0.6;

  const yForPrice = (price) => padding.top + ((maxPrice - price) / priceRange) * priceHeight;
  const xForIndex = (i) => i * candleWidth + candleWidth / 2;

  const maPoints = ma.map((v, i) => (v === null ? null : `${xForIndex(i)},${yForPrice(v)}`)).filter(Boolean).join(" ");

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

      {maPoints ? <polyline points={maPoints} className="chart-ma-line" /> : null}
    </svg>
  );
}

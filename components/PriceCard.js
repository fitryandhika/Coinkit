"use client";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

export default function PriceCard({ ticker }) {
  if (!ticker) return <div className="price-card empty">Memuat data...</div>;

  const isUp = (ticker.change24h ?? 0) >= 0;

  return (
    <div className="price-card">
      <div className="price-card-header">
        <h2>{ticker.symbol}</h2>
        <span className={isUp ? "change up" : "change down"}>
          {ticker.change24h === null ? "—" : `${isUp ? "+" : ""}${ticker.change24h.toFixed(2)}%`}
        </span>
      </div>
      <div className="price-card-last">{formatNumber(ticker.price, { maximumFractionDigits: 8 })}</div>
      <div className="price-card-grid">
        <div><span>High 24h</span><strong>{formatNumber(ticker.high24h)}</strong></div>
        <div><span>Low 24h</span><strong>{formatNumber(ticker.low24h)}</strong></div>
        <div><span>Volume</span><strong>{formatNumber(ticker.volume24h, { maximumFractionDigits: 0 })}</strong></div>
        <div><span>Bid/Ask</span><strong>{formatNumber(ticker.bid)} / {formatNumber(ticker.ask)}</strong></div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMarketTickers } from "@/hooks/useMarketTickers";
import TechnicalReportPanel from "@/components/technical/TechnicalReportPanel";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

export default function OpportunityDetail({ entry, mode, onClose }) {
  const { tickers, connectionStatus } = useMarketTickers(mode, [entry.symbol]);
  const [showTechnical, setShowTechnical] = useState(false);
  const live = tickers[entry.symbol];
  const price = live?.price ?? entry.price;

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h3>{entry.symbol}</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="detail-price">{formatNumber(price, { maximumFractionDigits: 8 })}</div>
      <p className="detail-sub">
        {connectionStatus === "ws-connected" ? "Live via WebSocket" : "Live via REST"} · Screener timeframe {entry.timeframe}
      </p>

      <div className="detail-grid">
        <div><span>24h Change</span><strong>{entry.change24h === null ? "—" : `${entry.change24h.toFixed(2)}%`}</strong></div>
        <div><span>24h Volume</span><strong>{formatNumber(entry.volume24h, { maximumFractionDigits: 0 })}</strong></div>
        <div><span>Momentum 1</span><strong>{entry.momentum?.m1 == null ? "—" : `${entry.momentum.m1.toFixed(2)}%`}</strong></div>
        <div><span>Volatility</span><strong>{entry.volatilityLabel}</strong></div>
        <div><span>Liquidity</span><strong>{entry.liquidityLabel}</strong></div>
        <div><span>Breakout</span><strong>{entry.breakout?.status || "—"}</strong></div>
      </div>

      <div className="detail-score">
        <h4>Market Opportunity Score: {formatNumber(entry.screenerScore, { maximumFractionDigits: 0 })}/100</h4>
        <p className="score-note">Bukan probability atau prediksi harga — hanya skor kondisi market saat ini.</p>
      </div>

      {entry.reasons?.length > 0 ? (
        <div className="detail-reasons">
          <h4>Reasons</h4>
          <ul>{entry.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </div>
      ) : null}

      <button className="chip" onClick={() => setShowTechnical((v) => !v)} style={{ marginTop: 12 }}>
        {showTechnical ? "Sembunyikan" : "Lihat"} Technical Analysis →
      </button>

      {showTechnical ? (
        <TechnicalReportPanel symbol={entry.symbol} market={mode} onClose={() => setShowTechnical(false)} />
      ) : null}
    </div>
  );
}

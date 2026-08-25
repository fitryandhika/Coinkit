"use client";

import { useState } from "react";
import CoinIcon from "@/components/CoinIcon";
import TechnicalReportPanel from "@/components/technical/TechnicalReportPanel";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

const DIRECTION_CONFIG = {
  BULLISH: { label: "BULLISH", color: "#16c784" },
  BEARISH: { label: "BEARISH", color: "#ea3943" },
  NEUTRAL: { label: "NEUTRAL", color: "#848e9c" },
};

export default function ScreenerCard({ entry, mode }) {
  const [showTechnical, setShowTechnical] = useState(false);
  const dirConfig = DIRECTION_CONFIG[entry.direction] || DIRECTION_CONFIG.NEUTRAL;

  return (
    <div className="screener-card">
      <div className="screener-card-top">
        <CoinIcon symbol={entry.symbol} size={30} />
        <div className="screener-card-title">
          <h3>{entry.symbol}</h3>
          <span className="detail-sub" style={{ marginBottom: 0 }}>{formatNumber(entry.price, { maximumFractionDigits: 8 })}</span>
        </div>
        <span className="direction-badge" style={{ color: dirConfig.color, borderColor: dirConfig.color }}>
          {dirConfig.label}
        </span>
        <span className="score-badge-lg">{formatNumber(entry.screenerScore, { maximumFractionDigits: 0 })}</span>
      </div>

      {entry.reasons?.length > 0 ? (
        <ul className="screener-reasons">
          {entry.reasons.map((r) => <li key={r}>✓ {r}</li>)}
        </ul>
      ) : (
        <p className="detail-sub">Belum ada kondisi menonjol yang terdeteksi.</p>
      )}

      {entry.tradeIdea?.entry ? (
        <div className="trade-idea-row">
          <div><span>Entry</span><strong>{formatNumber(entry.tradeIdea.entry, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>Stop Loss</span><strong className="c-red">{formatNumber(entry.tradeIdea.stopLoss?.price, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP1</span><strong className="c-green">{formatNumber(entry.tradeIdea.takeProfit?.tp1, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP2</span><strong className="c-green">{formatNumber(entry.tradeIdea.takeProfit?.tp2, { maximumFractionDigits: 8 })}</strong></div>
        </div>
      ) : (
        <p className="detail-sub">{entry.tradeIdea?.reason || "Level entry belum bisa ditentukan."}</p>
      )}

      <p className="score-note">
        Level ini murni referensi teknikal dari support/resistance &amp; momentum saat ini — bukan jaminan profit.
        Anda tetap memutuskan &amp; trading manual di Bitget.
      </p>

      <button className="chip" onClick={() => setShowTechnical((v) => !v)}>
        {showTechnical ? "Sembunyikan" : "Lihat"} Technical Analysis →
      </button>

      {showTechnical ? (
        <TechnicalReportPanel symbol={entry.symbol} market={mode} onClose={() => setShowTechnical(false)} />
      ) : null}
    </div>
  );
}

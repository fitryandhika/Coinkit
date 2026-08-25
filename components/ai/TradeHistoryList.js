"use client";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

export default function TradeHistoryList({ records }) {
  if (!records || records.length === 0) return <p className="detail-sub">Belum ada prediction yang dicatat.</p>;

  return (
    <div className="trade-history-list">
      {records.map((r) => (
        <div key={r.predictionId} className="detail-panel trade-history-item">
          <div className="detail-header">
            <h4>{r.symbol} · {r.decision}</h4>
            <span className={`status-badge status-${r.status.toLowerCase()}`}>{r.status}</span>
          </div>
          <p className="detail-sub">
            {new Date(r.timestamp).toLocaleString("id-ID")} · Score {formatNumber(r.aiScore, { maximumFractionDigits: 0 })}/100 · Confidence {formatNumber(r.confidence, { maximumFractionDigits: 0 })}/100
          </p>
          {r.journal ? (
            <p className="detail-sub">Result: <strong>{r.journal.result}</strong>{r.journal.pnl !== null ? ` · P/L: ${r.journal.pnl}` : ""}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

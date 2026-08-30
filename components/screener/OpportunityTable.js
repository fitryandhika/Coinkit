"use client";

import CoinIcon from "@/components/CoinIcon";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

function statusLabel(entry) {
  if (entry.exhaustion?.status === "POSSIBLE_EXHAUSTION") return "Possible Exhaustion";
  if (entry.breakout?.status === "BREAKOUT") return "Breakout";
  if (entry.breakout?.status === "WEAK_BREAKOUT") return "Weak Breakout";
  if (entry.breakout?.status === "BREAKOUT_PROXIMITY") return "Near Breakout";
  if (entry.momentumLabel === "STRONG_UP") return "Momentum";
  return "Normal";
}

const ENTRY_LABEL_TEXT = {
  GOOD: "Ideal",
  FAIR: "Wajar",
  EXTENDED: "Agak jauh",
  OVEREXTENDED: "Kemahalan",
  UNKNOWN: "—",
};

const ENTRY_LABEL_COLOR = {
  GOOD: "#16c784",
  FAIR: "#a6b0c3",
  EXTENDED: "#f0b90b",
  OVEREXTENDED: "#ea3943",
};

const COLUMNS = [
  { key: "rank", label: "Rank" },
  { key: "symbol", label: "Symbol" },
  { key: "price", label: "Price" },
  { key: "change24h", label: "24h" },
  { key: "screenerScore", label: "Score" },
  { key: "entryScore", label: "Entry" },
  { key: "riskReward", label: "R:R" },
  { key: "momentumScore", label: "Momentum" },
  { key: "volumeRatio", label: "Volume" },
  { key: "liquidityLabel", label: "Liquidity" },
  { key: "status", label: "Status" },
];

export default function OpportunityTable({ results, sortKey, sortDir, onSort, onSelect }) {
  return (
    <table className="market-table opportunity-table">
      <thead>
        <tr>
          {COLUMNS.map((col) => (
            <th key={col.key} onClick={() => !["rank", "status", "liquidityLabel"].includes(col.key) && onSort(col.key)}>
              {col.label}
              {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((entry, idx) => (
          <tr key={entry.symbol} onClick={() => onSelect(entry.symbol)} className="clickable-row">
            <td>{idx + 1}</td>
            <td>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CoinIcon symbol={entry.symbol} size={20} />
                {entry.symbol}
              </span>
            </td>
            <td>{formatNumber(entry.price, { maximumFractionDigits: 8 })}</td>
            <td className={(entry.change24h ?? 0) >= 0 ? "up" : "down"}>
              {entry.change24h === null ? "—" : `${entry.change24h >= 0 ? "+" : ""}${entry.change24h.toFixed(2)}%`}
            </td>
            <td>{formatNumber(entry.screenerScore, { maximumFractionDigits: 0 })}</td>
            <td style={{ color: ENTRY_LABEL_COLOR[entry.entryLabel] || undefined }}>
              {ENTRY_LABEL_TEXT[entry.entryLabel] || "—"}
              {Number.isFinite(entry.entryScore) ? ` (${entry.entryScore.toFixed(0)})` : ""}
            </td>
            <td>{Number.isFinite(entry.riskReward) ? entry.riskReward.toFixed(2) : "—"}</td>
            <td>{entry.momentumLabel || "—"}</td>
            <td>{entry.volumeRatio !== null ? `${entry.volumeRatio.toFixed(2)}x` : "—"}</td>
            <td>{entry.liquidityLabel || "—"}</td>
            <td>{statusLabel(entry)}</td>
          </tr>
        ))}
        {results.length === 0 ? (
          <tr><td colSpan={COLUMNS.length} className="empty-row">Tidak ada coin yang cocok dengan filter saat ini.</td></tr>
        ) : null}
      </tbody>
    </table>
  );
}

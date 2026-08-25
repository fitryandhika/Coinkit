"use client";

import CoinIcon from "@/components/CoinIcon";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

export default function MarketTable({ tickers, sortKey, sortDir, onSort, onSelect }) {
  const columns = [
    { key: "rank", label: "Rank" },
    { key: "symbol", label: "Symbol" },
    { key: "price", label: "Price" },
    { key: "change24h", label: "Change 24h" },
    { key: "volume24h", label: "Volume" },
  ];

  return (
    <table className="market-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} onClick={() => col.key !== "rank" && onSort(col.key)}>
              {col.label}
              {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tickers.map((t, idx) => (
          <tr key={t.symbol} className={onSelect ? "clickable-row" : undefined} onClick={() => onSelect && onSelect(t.symbol)}>
            <td>{idx + 1}</td>
            <td>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CoinIcon symbol={t.symbol} size={20} />
                {t.symbol}
              </span>
            </td>
            <td>{formatNumber(t.price, { maximumFractionDigits: 8 })}</td>
            <td className={(t.change24h ?? 0) >= 0 ? "up" : "down"}>
              {t.change24h === null ? "—" : `${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(2)}%`}
            </td>
            <td>{formatNumber(t.volume24h, { maximumFractionDigits: 0 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

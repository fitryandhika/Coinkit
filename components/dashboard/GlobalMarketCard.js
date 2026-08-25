"use client";

import { useEffect, useState } from "react";

function formatCompact(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString("en-US")}`;
}

/** Data nyata dari CoinGecko (endpoint publik gratis) — tidak ada sparkline karena
 * tier gratis tidak menyediakan riwayat, dan kita tidak membuat tren palsu. */
export default function GlobalMarketCard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch("/api/market/global")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json);
          setStatus("ok");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status !== "ok" || !data) {
    return (
      <div className="global-market-grid">
        <div className="panel-card global-market-card"><span className="detail-sub" style={{ marginBottom: 0 }}>Memuat market cap...</span></div>
        <div className="panel-card global-market-card"><span className="detail-sub" style={{ marginBottom: 0 }}>Memuat dominance...</span></div>
      </div>
    );
  }

  const changeUp = (data.marketCapChangePct24h ?? 0) >= 0;

  return (
    <div className="global-market-grid">
      <div className="panel-card global-market-card">
        <span className="detail-sub" style={{ marginBottom: 0 }}>Total Market Cap</span>
        <div className="global-market-value">{formatCompact(data.totalMarketCapUsd)}</div>
        {data.marketCapChangePct24h !== null ? (
          <span className={changeUp ? "price-list-change up" : "price-list-change down"}>
            {changeUp ? "+" : ""}{data.marketCapChangePct24h.toFixed(2)}%
          </span>
        ) : null}
      </div>
      <div className="panel-card global-market-card">
        <span className="detail-sub" style={{ marginBottom: 0 }}>BTC Dominance</span>
        <div className="global-market-value">{data.btcDominancePct !== null ? `${data.btcDominancePct.toFixed(2)}%` : "—"}</div>
      </div>
    </div>
  );
}

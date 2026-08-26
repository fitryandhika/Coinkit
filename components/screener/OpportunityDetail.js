"use client";

import { useMarketTickers } from "@/hooks/useMarketTickers";
import ScreenerCard from "@/components/screener/ScreenerCard";

/** Pakai ulang tampilan ScreenerCard supaya card di Opportunities & Screener
 * selalu identik — cuma tambah tombol tutup dan override harga jadi live (WebSocket). */
export default function OpportunityDetail({ entry, mode, onClose }) {
  const { tickers } = useMarketTickers(mode, [entry.symbol]);
  const live = tickers[entry.symbol];
  const liveEntry = live ? { ...entry, price: live.price, change24h: live.change24h ?? entry.change24h } : entry;

  return (
    <div className="opportunity-detail-wrap">
      <div className="opportunity-detail-close-row">
        <button onClick={onClose} className="close-btn">✕ Tutup</button>
      </div>
      <ScreenerCard entry={liveEntry} mode={mode} />
    </div>
  );
}

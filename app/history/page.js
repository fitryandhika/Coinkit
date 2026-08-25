"use client";

import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { usePredictions } from "@/hooks/usePredictions";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

export default function HistoryPage() {
  const { records, loaded } = usePredictions({ limit: 100 });
  if (!loaded) return null;

  return (
    <>
      <Topbar title="AI History" showSearch={false} />
      <div className="chip-group"><Link className="chip" href="/performance">Performance Dashboard →</Link></div>

      {records.length === 0 ? <p className="detail-sub">Belum ada prediction.</p> : null}

      <div className="trade-history-list">
        {records.map((r) => (
          <Link key={r.id} href={`/history/${r.id}`} className="detail-panel trade-history-item history-link">
            <div className="detail-header">
              <h4>{r.symbol} · {r.decision}</h4>
              <span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status}</span>
            </div>
            <p className="detail-sub">
              Score {formatNumber(r.score, { maximumFractionDigits: 0 })} · Confidence {formatNumber(r.confidence, { maximumFractionDigits: 0 })} · {new Date(r.timestamp).toLocaleString("id-ID")}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

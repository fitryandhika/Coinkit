"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Topbar from "@/components/layout/Topbar";
import { usePredictions } from "@/hooks/usePredictions";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

function ScatterCard({ title, data, xKey, yKey, xLabel, yLabel }) {
  const points = data.filter((d) => d[xKey] !== null && d[yKey] !== null);
  if (points.length < 5) return null; // jangan bikin grafik kalau data belum cukup

  return (
    <div className="panel-card">
      <h4 className="section-title">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#2b3139" />
          <XAxis dataKey={xKey} name={xLabel} stroke="#848e9c" fontSize={11} />
          <YAxis dataKey={yKey} name={yLabel} stroke="#848e9c" fontSize={11} />
          <Tooltip contentStyle={{ background: "#181a20", border: "1px solid #2b3139" }} />
          <Scatter data={points} fill="#f0b90b" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ScreenerHistoryPage() {
  const { records, loaded } = usePredictions({ limit: 100 });
  const [report, setReport] = useState(null);
  const [reportStatus, setReportStatus] = useState("loading");

  useEffect(() => {
    fetch("/api/performance")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) { setReport(json); setReportStatus("ok"); } else setReportStatus("error");
      })
      .catch(() => setReportStatus("error"));
  }, []);

  if (!loaded) return null;

  return (
    <>
      <Topbar title="Screener History" showSearch={false} />

      {reportStatus === "ok" && report ? (
        <>
          {report.insufficientData ? (
            <p className="error-banner">
              Insufficient historical data for reliable performance conclusions. (Total: {report.overall.totalPredictions})
            </p>
          ) : null}

          <div className="panel-card">
            <div className="detail-grid">
              <div><span>Total Setup Tercatat</span><strong>{report.overall.totalPredictions}</strong></div>
              <div><span>Selesai Dievaluasi</span><strong>{report.overall.completed}</strong></div>
              <div><span>Masih Dipantau</span><strong>{report.overall.pending}</strong></div>
              <div><span>TP Hit Rate</span><strong>{formatNumber(report.overall.tpHitRate, { maximumFractionDigits: 1 })}%</strong></div>
              <div><span>SL Hit Rate</span><strong>{formatNumber(report.overall.slHitRate, { maximumFractionDigits: 1 })}%</strong></div>
              <div><span>Avg Max Gain</span><strong>{formatNumber(report.overall.averageMaxGainPct, { maximumFractionDigits: 2 })}%</strong></div>
              <div><span>Avg Max Drawdown</span><strong>{formatNumber(report.overall.averageMaxDrawdownPct, { maximumFractionDigits: 2 })}%</strong></div>
              <div><span>Avg R</span><strong>{formatNumber(report.overall.averageR, { maximumFractionDigits: 2 })}R</strong></div>
              <div><span>Opportunity Capture</span><strong>{formatNumber(report.opportunityCaptureRate, { maximumFractionDigits: 1 })}%</strong></div>
              <div><span>Setup Terbaik</span><strong>{report.bestSetup ?? "—"}</strong></div>
              <div><span>Timeframe Terbaik</span><strong>{report.bestTimeframe ?? "—"}</strong></div>
            </div>
            <p className="score-note">
              Setup dengan Screener Score ≥ 60 otomatis dicatat saat terdeteksi di halaman Screener, lalu dipantau
              ke pergerakan market asli — bukan hasil trading manual Anda.
            </p>
          </div>

          <ScatterCard title="Screener Score vs Maximum Gain" data={report.scatterData} xKey="score" yKey="maxGain" xLabel="Score" yLabel="Max Gain %" />
          <ScatterCard title="Technical Score vs Maximum Gain" data={report.scatterData} xKey="technicalScore" yKey="maxGain" xLabel="Technical Score" yLabel="Max Gain %" />
          <ScatterCard title="Screener Score vs Maximum Drawdown" data={report.scatterData} xKey="score" yKey="maxDrawdown" xLabel="Score" yLabel="Max Drawdown %" />
        </>
      ) : null}

      <h2 className="section-title">Riwayat Setup</h2>
      {records.length === 0 ? <p className="detail-sub">Belum ada setup yang tercatat.</p> : null}
      <div className="trade-history-list">
        {records.map((r) => (
          <Link key={r.id} href={`/screener-history/${r.id}`} className="detail-panel trade-history-item history-link">
            <div className="detail-header">
              <h4>{r.symbol} · {r.decision}</h4>
              <span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status}</span>
            </div>
            <p className="detail-sub">
              Score {formatNumber(r.score, { maximumFractionDigits: 0 })} · {new Date(r.timestamp).toLocaleString("id-ID")}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

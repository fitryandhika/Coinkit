"use client";

import { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Topbar from "@/components/layout/Topbar";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

function ScatterCard({ title, data, xKey, yKey, xLabel, yLabel }) {
  const points = data.filter((d) => d[xKey] !== null && d[yKey] !== null);
  if (points.length < 5) return null;

  return (
    <div className="panel-card">
      <h4 className="section-title">{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
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

export default function PerformancePage() {
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch("/api/performance")
      .then((res) => res.json())
      .then((json) => { if (json.success) { setReport(json); setStatus("ok"); } else setStatus("error"); })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <><Topbar title="Performance Dashboard" showSearch={false} /><p className="detail-sub">Memuat...</p></>;
  if (status === "error" || !report) return <><Topbar title="Performance Dashboard" showSearch={false} /><p className="error-banner">Gagal memuat performance data.</p></>;

  return (
    <>
      <Topbar title="Performance Dashboard" showSearch={false} />

      {report.insufficientData ? (
        <p className="error-banner">Insufficient historical data for reliable performance conclusions. (Total predictions: {report.overall.totalPredictions})</p>
      ) : null}

      <div className="panel-card">
        <div className="detail-grid">
          <div><span>Total Predictions</span><strong>{report.overall.totalPredictions}</strong></div>
          <div><span>Completed</span><strong>{report.overall.completed}</strong></div>
          <div><span>Pending</span><strong>{report.overall.pending}</strong></div>
          <div><span>TP Hit Rate</span><strong>{formatNumber(report.overall.tpHitRate, { maximumFractionDigits: 1 })}%</strong></div>
          <div><span>SL Hit Rate</span><strong>{formatNumber(report.overall.slHitRate, { maximumFractionDigits: 1 })}%</strong></div>
          <div><span>Avg Max Gain</span><strong>{formatNumber(report.overall.averageMaxGainPct, { maximumFractionDigits: 2 })}%</strong></div>
          <div><span>Avg Max Drawdown</span><strong>{formatNumber(report.overall.averageMaxDrawdownPct, { maximumFractionDigits: 2 })}%</strong></div>
          <div><span>Avg R</span><strong>{formatNumber(report.overall.averageR, { maximumFractionDigits: 2 })}R</strong></div>
          <div><span>Opportunity Capture</span><strong>{formatNumber(report.opportunityCaptureRate, { maximumFractionDigits: 1 })}%</strong></div>
          <div><span>Best Setup</span><strong>{report.bestSetup ?? "—"}</strong></div>
          <div><span>Worst Setup</span><strong>{report.worstSetup ?? "—"}</strong></div>
          <div><span>Best Timeframe</span><strong>{report.bestTimeframe ?? "—"}</strong></div>
        </div>
        <p className="score-note">Metrik ini mengukur performa AI mendeteksi opportunity di market (bukan hasil trading nyata Anda) — lihat P/L aktual di halaman History per-prediction.</p>
      </div>

      <ScatterCard title="AI Score vs Maximum Gain" data={report.scatterData} xKey="score" yKey="maxGain" xLabel="AI Score" yLabel="Max Gain %" />
      <ScatterCard title="Confidence vs Maximum Gain" data={report.scatterData} xKey="confidence" yKey="maxGain" xLabel="Confidence" yLabel="Max Gain %" />
      <ScatterCard title="Technical Score vs Maximum Gain" data={report.scatterData} xKey="technicalScore" yKey="maxGain" xLabel="Technical Score" yLabel="Max Gain %" />
      <ScatterCard title="Risk Score vs Maximum Drawdown" data={report.scatterData} xKey="riskScore" yKey="maxDrawdown" xLabel="Risk Score" yLabel="Max Drawdown %" />
      <ScatterCard title="AI Score vs Maximum Drawdown" data={report.scatterData} xKey="score" yKey="maxDrawdown" xLabel="AI Score" yLabel="Max Drawdown %" />
    </>
  );
}

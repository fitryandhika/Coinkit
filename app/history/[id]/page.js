"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

export default function PredictionDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch(`/api/predictions/${id}`)
      .then((res) => res.json())
      .then((json) => { if (json.success) { setData(json); setStatus("ok"); } else setStatus("error"); })
      .catch(() => setStatus("error"));
  }, [id]);

  if (status === "loading") return <><Topbar title="Prediction Detail" showSearch={false} /><p className="detail-sub">Memuat...</p></>;
  if (status === "error" || !data) return <><Topbar title="Prediction Detail" showSearch={false} /><p className="error-banner">Prediction tidak ditemukan.</p></>;

  const { prediction, outcome, manualTrade } = data;

  return (
    <>
      <Topbar title={`${prediction.symbol} · ${prediction.decision}`} showSearch={false} />
      <p className="detail-sub">Created: {new Date(prediction.timestamp).toLocaleString("id-ID")}</p>

      <div className="panel-card">
        <div className="detail-grid">
          <div><span>AI Score</span><strong>{formatNumber(prediction.score, { maximumFractionDigits: 0 })}/100</strong></div>
          <div><span>Confidence</span><strong>{formatNumber(prediction.confidence, { maximumFractionDigits: 0 })}/100</strong></div>
        </div>

        <h4 className="section-title">Trade Plan</h4>
        <div className="detail-grid">
          <div><span>Entry</span><strong>{formatNumber(prediction.entry, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>SL</span><strong>{formatNumber(prediction.stop_loss, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP1</span><strong>{formatNumber(prediction.tp1, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP2</span><strong>{formatNumber(prediction.tp2, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP3</span><strong>{formatNumber(prediction.tp3, { maximumFractionDigits: 8 })}</strong></div>
        </div>

        {outcome ? (
          <>
            <h4 className="section-title">Actual Market</h4>
            <div className="detail-grid">
              <div><span>Maximum Gain</span><strong>{outcome.maximum_gain_pct === null ? "—" : `${outcome.maximum_gain_pct}%`}</strong></div>
              <div><span>Maximum Drawdown</span><strong>{outcome.maximum_drawdown_pct === null ? "—" : `${outcome.maximum_drawdown_pct}%`}</strong></div>
              <div><span>Maximum R</span><strong>{outcome.maximum_r === null ? "—" : `${outcome.maximum_r}R`}</strong></div>
            </div>
            <h4 className="section-title">Outcome</h4>
            <p className="detail-sub" style={{ fontSize: 16, fontWeight: 700 }}>{outcome.outcome}</p>
          </>
        ) : <p className="detail-sub">Outcome belum tersedia — menunggu worker memproses.</p>}

        {prediction.reasoning ? (
          <>
            <h4 className="section-title">AI Reasoning</h4>
            <p className="detail-sub">{prediction.reasoning.marketContext}</p>
            <p className="detail-sub">{prediction.reasoning.decisionReason}</p>
          </>
        ) : null}

        {manualTrade ? (
          <>
            <h4 className="section-title">Manual Trade</h4>
            <div className="detail-grid">
              <div><span>Actual Entry</span><strong>{formatNumber(manualTrade.actual_entry, { maximumFractionDigits: 8 })}</strong></div>
              <div><span>Actual Exit</span><strong>{formatNumber(manualTrade.actual_exit, { maximumFractionDigits: 8 })}</strong></div>
              <div><span>Realized P/L</span><strong>{formatNumber(manualTrade.realized_pnl, { maximumFractionDigits: 4 })}</strong></div>
              <div><span>Realized P/L %</span><strong>{formatNumber(manualTrade.realized_pnl_pct, { maximumFractionDigits: 2 })}%</strong></div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

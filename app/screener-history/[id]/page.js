"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}

export default function ScreenerHistoryDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch(`/api/predictions/${id}`)
      .then((res) => res.json())
      .then((json) => { if (json.success) { setData(json); setStatus("ok"); } else setStatus("error"); })
      .catch(() => setStatus("error"));
  }, [id]);

  if (status === "loading") return <><Topbar title="Detail Setup" /><p className="detail-sub">Memuat...</p></>;
  if (status === "error" || !data) return <><Topbar title="Detail Setup" /><p className="error-banner">Data tidak ditemukan.</p></>;

  const { prediction, outcome, manualTrade } = data;

  return (
    <>
      <Topbar title={`${prediction.symbol} · ${prediction.decision}`} />
      <p className="detail-sub">Tercatat: {new Date(prediction.timestamp).toLocaleString("id-ID")}</p>

      <div className="panel-card">
        <div className="detail-grid">
          <div><span>Screener Score</span><strong>{formatNumber(prediction.score, { maximumFractionDigits: 0 })}/100</strong></div>
          <div><span>Timeframe</span><strong>{prediction.timeframe}</strong></div>
        </div>

        <h4 className="section-title">Level Saat Dicatat</h4>
        <div className="detail-grid">
          <div><span>Entry</span><strong>{formatNumber(prediction.entry, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>Stop Loss Awal</span><strong>{formatNumber(prediction.stop_loss, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP1 (referensi)</span><strong>{formatNumber(prediction.tp1, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP2 (referensi)</span><strong>{formatNumber(prediction.tp2, { maximumFractionDigits: 8 })}</strong></div>
          <div><span>TP3 (referensi)</span><strong>{formatNumber(prediction.tp3, { maximumFractionDigits: 8 })}</strong></div>
        </div>

        {prediction.trail_atr !== null && prediction.trail_atr !== undefined ? (
          <>
            <h4 className="section-title">Pengaturan Trailing Stop</h4>
            <div className="detail-grid">
              <div><span>ATR Trailing</span><strong>{formatNumber(prediction.trail_atr, { maximumFractionDigits: 8 })}</strong></div>
              <div><span>Trail Multiplier</span><strong>{formatNumber(prediction.trail_multiplier, { maximumFractionDigits: 2 })}x</strong></div>
              <div><span>Korelasi BTC</span><strong>{prediction.btc_correlation === null || prediction.btc_correlation === undefined ? "—" : prediction.btc_correlation.toFixed(2)}</strong></div>
            </div>
            <p className="score-note">
              TP1/TP2/TP3 di atas hanya penanda referensi — exit sesungguhnya mengikuti stop loss yang bergerak
              (breakeven lalu trailing), bukan berhenti otomatis begitu TP tersentuh.
            </p>
          </>
        ) : (
          <p className="detail-sub">Setup ini dicatat sebelum fitur trailing stop aktif — memakai SL tetap.</p>
        )}

        {outcome ? (
          <>
            <h4 className="section-title">Pergerakan Market Aktual</h4>
            <div className="detail-grid">
              <div><span>Maximum Gain</span><strong>{outcome.maximum_gain_pct === null ? "—" : `${outcome.maximum_gain_pct}%`}</strong></div>
              <div><span>Maximum Drawdown</span><strong>{outcome.maximum_drawdown_pct === null ? "—" : `${outcome.maximum_drawdown_pct}%`}</strong></div>
              <div><span>Maximum R</span><strong>{outcome.maximum_r === null ? "—" : `${outcome.maximum_r}R`}</strong></div>
              {outcome.exit_price !== null && outcome.exit_price !== undefined ? (
                <div><span>Exit Price</span><strong>{formatNumber(outcome.exit_price, { maximumFractionDigits: 8 })}</strong></div>
              ) : null}
              {outcome.breakeven_activated ? (
                <div><span>Breakeven</span><strong className="c-green">Aktif</strong></div>
              ) : null}
              {outcome.final_stop_price !== null && outcome.final_stop_price !== undefined ? (
                <div><span>Stop Terakhir</span><strong>{formatNumber(outcome.final_stop_price, { maximumFractionDigits: 8 })}</strong></div>
              ) : null}
            </div>
            <h4 className="section-title">Hasil</h4>
            <p className="detail-sub" style={{ fontSize: 16, fontWeight: 700 }}>{outcome.outcome}</p>
          </>
        ) : <p className="detail-sub">Hasil belum tersedia — menunggu worker memproses.</p>}

        {prediction.reasoning?.reasons?.length > 0 ? (
          <>
            <h4 className="section-title">Alasan Screener</h4>
            <ul className="score-breakdown">
              {prediction.reasoning.reasons.map((r) => <li key={r}>✓ {r}</li>)}
            </ul>
          </>
        ) : null}

        {manualTrade ? (
          <>
            <h4 className="section-title">Trade Manual Anda</h4>
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

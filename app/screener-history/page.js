"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { usePredictions } from "@/hooks/usePredictions";

function fmt(value, digits = 2, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits })}${suffix}`;
}

const VERDICT_STYLE = {
  EDGE: { color: "#16c784", label: "TERBUKTI PREDIKTIF" },
  WEAK_EDGE: { color: "#f0b90b", label: "PREDIKTIF LEMAH" },
  NO_EDGE: { color: "#f0b90b", label: "BELUM TERBUKTI" },
  INVERTED: { color: "#ea3943", label: "TERBALIK" },
  INSUFFICIENT: { color: "#848e9c", label: "DATA BELUM CUKUP" },
};

function VerdictCard({ calibration }) {
  const style = VERDICT_STYLE[calibration.verdict.level] || VERDICT_STYLE.INSUFFICIENT;
  return (
    <div className="panel-card" style={{ borderLeft: `3px solid ${style.color}` }}>
      <h4 className="section-title" style={{ color: style.color, marginTop: 0 }}>{style.label}</h4>
      <p className="detail-sub" style={{ marginBottom: 8 }}>{calibration.verdict.text}</p>
      <div className="detail-grid">
        <div><span>Korelasi Score vs Hasil</span><strong>{fmt(calibration.scoreVsResultCorrelation, 3)}</strong></div>
        <div><span>Sampel Terhitung</span><strong>{calibration.sampleSize}</strong></div>
        <div><span>Belum Bisa Dihitung</span><strong>{calibration.unresolved}</strong></div>
      </div>
    </div>
  );
}

function BucketTable({ buckets }) {
  if (!buckets?.length) return null;
  return (
    <div className="panel-card">
      <h4 className="section-title">Hasil per Rentang Score</h4>
      <p className="detail-sub">Kalau score bekerja, kolom Avg R harus naik dari atas ke bawah.</p>
      <table className="market-table history-table">
        <thead>
          <tr><th>Score</th><th>n</th><th>Win%</th><th>Avg R</th><th>Expectancy</th></tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label} style={{ opacity: b.reliable ? 1 : 0.45 }}>
              <td>{b.label}{b.reliable ? "" : " *"}</td>
              <td>{b.scored}</td>
              <td>{fmt(b.winRate, 1, "%")}</td>
              <td className={b.avgR > 0 ? "c-green" : b.avgR < 0 ? "c-red" : ""}>{fmt(b.avgR, 2, "R")}</td>
              <td>{fmt(b.expectancy, 2, "R")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="score-note">* sampel masih di bawah 10 — belum bisa dipercaya.</p>
    </div>
  );
}

function AttributionCard({ attribution, suggestion }) {
  return (
    <div className="panel-card">
      <h4 className="section-title">Kontribusi Tiap Komponen</h4>
      <p className="detail-sub">Korelasi sub-score terhadap hasil nyata — dasar untuk menggeser bobot.</p>
      <table className="market-table history-table">
        <thead><tr><th>Komponen</th><th>n</th><th>Korelasi</th><th>Status</th></tr></thead>
        <tbody>
          {attribution.map((a) => (
            <tr key={a.key}>
              <td>{a.label}</td>
              <td>{a.n}</td>
              <td className={a.meaningful ? (a.correlation > 0 ? "c-green" : "c-red") : ""}>{fmt(a.correlation, 3)}</td>
              <td><span className="detail-sub" style={{ marginBottom: 0 }}>{a.note}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="section-title">Usulan Bobot</h4>
      {suggestion.available ? (
        <>
          <p className="detail-sub">{suggestion.reason}</p>
          <div className="detail-grid">
            {Object.entries(suggestion.weights).map(([key, value]) => (
              <div key={key}>
                <span>{key.replace("_WEIGHT", "")}</span>
                <strong>{fmt(suggestion.current[key], 3)} → {fmt(value, 3)}</strong>
              </div>
            ))}
          </div>
          <p className="score-note">
            Usulan ini TIDAK diterapkan otomatis. Ubah manual di lib/screener/config.js kalau Anda setuju —
            kalibrasi otomatis pada sampel kecil adalah cara tercepat membuat model overfit.
          </p>
        </>
      ) : (
        <p className="detail-sub">{suggestion.reason}</p>
      )}
    </div>
  );
}

function ControlCard({ control }) {
  return (
    <div className="panel-card">
      <h4 className="section-title">Pembanding: Ambang Score 60</h4>
      {control.available ? (
        <>
          <p className="detail-sub">{control.verdict}</p>
          <div className="detail-grid">
            <div><span>Lolos Ambang — Avg R</span><strong>{fmt(control.eligible.avgR, 2, "R")}</strong></div>
            <div><span>Lolos Ambang — Win%</span><strong>{fmt(control.eligible.winRate, 1, "%")}</strong></div>
            <div><span>Kontrol — Avg R</span><strong>{fmt(control.control.avgR, 2, "R")}</strong></div>
            <div><span>Kontrol — Win%</span><strong>{fmt(control.control.winRate, 1, "%")}</strong></div>
            <div><span>Selisih</span><strong className={control.edgeR > 0 ? "c-green" : "c-red"}>{fmt(control.edgeR, 2, "R")}</strong></div>
          </div>
        </>
      ) : (
        <p className="detail-sub">{control.reason}</p>
      )}
    </div>
  );
}

function BreakdownCard({ title, data }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v.scored > 0);
  if (entries.length === 0) return null;
  return (
    <div className="panel-card">
      <h4 className="section-title">{title}</h4>
      <table className="market-table history-table">
        <thead><tr><th></th><th>n</th><th>Win%</th><th>Avg R</th></tr></thead>
        <tbody>
          {entries.map(([key, v]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>{v.scored}</td>
              <td>{fmt(v.winRate, 1, "%")}</td>
              <td className={v.avgR > 0 ? "c-green" : v.avgR < 0 ? "c-red" : ""}>{fmt(v.avgR, 2, "R")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScreenerHistoryPage() {
  const router = useRouter();
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

  return (
    <>
      <Topbar title="Kalibrasi Score" />

      {reportStatus === "loading" ? <p className="detail-sub">Menghitung kalibrasi...</p> : null}
      {reportStatus === "error" ? <p className="error-banner">Gagal memuat laporan kalibrasi.</p> : null}

      {reportStatus === "ok" && report ? (
        <>
          <VerdictCard calibration={report.scoreCalibration} />

          <div className="panel-card">
            <h4 className="section-title" style={{ marginTop: 0 }}>Ringkasan</h4>
            <div className="detail-grid">
              <div><span>Setup Tercatat</span><strong>{report.totals.recorded}</strong></div>
              <div><span>Selesai Dievaluasi</span><strong>{report.totals.completed}</strong></div>
              <div><span>Control Group</span><strong>{report.totals.control}</strong></div>
              <div><span>Avg R (bersih fee)</span><strong className={report.overall.avgR > 0 ? "c-green" : "c-red"}>{fmt(report.overall.avgR, 2, "R")}</strong></div>
              <div><span>Win Rate</span><strong>{fmt(report.overall.winRate, 1, "%")}</strong></div>
              <div><span>Expectancy</span><strong>{fmt(report.overall.expectancy, 2, "R")}</strong></div>
              <div><span>Total R</span><strong>{fmt(report.overall.totalR, 2, "R")}</strong></div>
              <div><span>Max Drawdown</span><strong className="c-red">{fmt(report.overall.maxDrawdownR, 2, "R")}</strong></div>
              <div><span>Kalah Beruntun Terpanjang</span><strong>{report.overall.longestLossStreak}x</strong></div>
              <div><span>Avg MFE</span><strong>{fmt(report.overall.avgMfeR, 2, "R")}</strong></div>
              <div><span>Avg MAE</span><strong>{fmt(report.overall.avgMaeR, 2, "R")}</strong></div>
            </div>
            <p className="score-note">
              Semua R sudah dikurangi fee taker Bitget (spot {report.feeAssumption.spot}% &amp; futures {report.feeAssumption.futures}% per sisi).
              Avg MFE jauh di atas Avg R berarti harga sempat bergerak menguntungkan tapi profitnya tidak sempat diamankan.
            </p>
          </div>

          <BucketTable buckets={report.scoreCalibration.buckets} />
          <ControlCard control={report.controlComparison} />
          <AttributionCard attribution={report.componentAttribution} suggestion={report.weightSuggestion} />
          <BreakdownCard title="Per Arah" data={report.breakdowns.byDirection} />
          <BreakdownCard title="Per Timeframe" data={report.breakdowns.byTimeframe} />
          <BreakdownCard title="Per Jenis Hasil" data={report.breakdowns.byOutcome} />
        </>
      ) : null}

      <h2 className="section-title">Riwayat Setup</h2>
      {!loaded ? <p className="detail-sub">Memuat...</p> : records.length === 0 ? (
        <p className="detail-sub">Belum ada setup yang tercatat.</p>
      ) : (
        <div className="panel-card">
          <table className="market-table history-table">
            <thead>
              <tr><th>Symbol</th><th>Arah</th><th>Score</th><th>TF</th><th>Status</th><th>Tanggal</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="clickable-row" onClick={() => router.push(`/screener-history/${r.id}`)}>
                  <td>{r.symbol}</td>
                  <td>{r.decision}</td>
                  <td>{fmt(r.score, 0)}</td>
                  <td>{r.timeframe}</td>
                  <td><span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status}</span></td>
                  <td>{new Date(r.timestamp).toLocaleDateString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

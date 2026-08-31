"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { usePredictions } from "@/hooks/usePredictions";

function fmt(value, digits = 2, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits })}${suffix}`;
}

/** Nol bukan hijau. Warna hanya dipakai kalau memang untung atau rugi. */
function rClass(value) {
  if (!Number.isFinite(value) || value === 0) return "c-neutral";
  return value > 0 ? "c-green" : "c-red";
}

/** Label mentah dari database terlalu panjang untuk layar HP. */
const OUTCOME_LABEL = {
  TRAILING_STOP_HIT: "Trailing Stop",
  SL_HIT: "Stop Loss",
  TP1_HIT: "TP1",
  TP2_HIT: "TP2",
  TP3_HIT: "TP3",
  EXPIRED: "Kadaluarsa",
  NOT_APPLICABLE: "Tidak Berlaku",
  NO_DATA: "Data Candle Kosong",
  PENDING: "Berjalan",
};

/** Alasan keluar — supaya terlihat berapa banyak setup yang benar-benar kena
 * level, dan berapa yang cuma habis waktu. */
const EXIT_REASON_LABEL = {
  STOP_LEVEL: "Kena Stop Loss",
  TRAILING_STOP: "Kena Trailing Stop",
  TP_LEVEL: "Kena Target",
  HORIZON_CLOSE: "Habis Waktu (close)",
  HORIZON_CLOSE_PARTIAL_DATA: "Habis Waktu (data bolong)",
  NO_CANDLE_DATA: "Tanpa Data Candle",
};

const VERDICT_STYLE = {
  EDGE: { color: "#16c784", label: "TERBUKTI PREDIKTIF" },
  WEAK_EDGE: { color: "#f0b90b", label: "PREDIKTIF LEMAH" },
  NO_EDGE: { color: "#f0b90b", label: "BELUM TERBUKTI" },
  INVERTED: { color: "#ea3943", label: "TERBALIK" },
  INSUFFICIENT: { color: "#848e9c", label: "DATA BELUM CUKUP" },
};

function Table({ headers, children }) {
  return (
    <div className="table-scroll">
      <table className="calib-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function VerdictCard({ calibration }) {
  const style = VERDICT_STYLE[calibration.verdict.level] || VERDICT_STYLE.INSUFFICIENT;
  return (
    <div className="panel-card verdict-card" style={{ borderLeftColor: style.color }}>
      <p className="verdict-title" style={{ color: style.color }}>{style.label}</p>
      <p className="verdict-text">{calibration.verdict.text}</p>
      <div className="stat-tiles">
        <div className="stat-tile">
          <span>Korelasi Score vs Hasil</span>
          <strong>{fmt(calibration.scoreVsResultCorrelation, 3)}</strong>
        </div>
        <div className="stat-tile">
          <span>Sampel Terhitung</span>
          <strong>{calibration.sampleSize}</strong>
        </div>
      </div>
      <p className="calib-card-sub" style={{ margin: 0 }}>
        Korelasi memakai {calibration.sampleSizeEligible} setup lolos ambang + {calibration.controlIncluded} control
        group. Control sengaja diikutkan: tanpa setup ber-score rendah, rentang score-nya terlalu sempit untuk diuji.
      </p>
      {calibration.unresolved > 0 ? (
        <p className="calib-card-sub" style={{ margin: 0 }}>
          {calibration.unresolved} setup selesai tapi harga keluarnya tidak tercatat, jadi tidak ikut dihitung.
        </p>
      ) : null}
    </div>
  );
}

function SummaryCard({ overall, totals, fee }) {
  // Semua angka di kartu ini berasal dari POPULASI YANG SAMA: setup lolos
  // ambang (bukan control), sudah selesai, dan hasilnya terhitung. Versi lama
  // mencampur tiga populasi berbeda dalam satu kartu — "Setup Tercatat" termasuk
  // control, "Avg R" tidak, dan "Sampel Terhitung" ikut lagi.
  const tiles = [
    ["Setup Tercatat", totals.eligibleRecorded],
    ["Masih Berjalan", totals.stillRunning],
    ["Selesai Dievaluasi", totals.eligibleCompleted],
    ["Masuk Hitungan", totals.eligibleScored],
    ["Avg R (bersih fee)", fmt(overall.avgR, 2, "R"), rClass(overall.avgR)],
    ["Win Rate", fmt(overall.winRate, 1, "%")],
    ["Total R", fmt(overall.totalR, 2, "R"), rClass(overall.totalR)],
    ["Max Drawdown", fmt(overall.maxDrawdownR, 2, "R"), "c-red"],
    ["Kalah Beruntun", `${overall.longestLossStreak}x`],
    ["Control Group", totals.control],
    ["Tanpa Harga Keluar", totals.unresolved],
    ["Avg MFE", fmt(overall.avgMfeR, 2, "R")],
    ["Avg MAE", fmt(overall.avgMaeR, 2, "R")],
  ];

  return (
    <div className="panel-card">
      <p className="calib-card-title">Ringkasan</p>
      <p className="calib-card-sub">
        Semua R sudah dikurangi fee taker Bitget (spot {fee.spot}%, futures {fee.futures}% per sisi). Angka di bawah
        hanya menghitung setup lolos ambang yang SUDAH SELESAI — setup yang masih berjalan tidak ikut, supaya hasilnya
        tidak berubah-ubah sendiri setiap worker jalan.
      </p>
      <div className="stat-tiles">
        {tiles.map(([label, value, cls]) => (
          <div className="stat-tile" key={label}>
            <span>{label}</span>
            <strong className={cls || ""}>{value}</strong>
          </div>
        ))}
      </div>
      <p className="calib-card-sub" style={{ margin: 0 }}>
        Avg MFE jauh di atas Avg R berarti harga sempat bergerak menguntungkan tapi profitnya tidak sempat diamankan.
      </p>
    </div>
  );
}

function BucketTable({ buckets }) {
  if (!buckets?.length) return null;
  return (
    <div className="panel-card">
      <p className="calib-card-title">Hasil per Rentang Score</p>
      <p className="calib-card-sub">Kalau score bekerja, kolom Avg R harus naik dari atas ke bawah.</p>
      <Table headers={["Score", "n", "Win%", "Avg R", "Avg MFE"]}>
        {buckets.map((b) => (
          <tr key={b.label} className={b.reliable ? "" : "row-muted"}>
            <td>{b.label}{b.reliable ? "" : " *"}</td>
            <td className="num">{b.scored}</td>
            <td className="num">{fmt(b.winRate, 1, "%")}</td>
            <td className={`num ${rClass(b.avgR)}`}>{fmt(b.avgR, 2, "R")}</td>
            <td className="num">{fmt(b.avgMfeR, 2, "R")}</td>
          </tr>
        ))}
      </Table>
      <p className="calib-card-sub" style={{ margin: "10px 0 0" }}>* sampel di bawah 10 — belum bisa dipercaya.</p>
    </div>
  );
}

function AttributionCard({ attribution, suggestion }) {
  return (
    <div className="panel-card">
      <p className="calib-card-title">Kontribusi Tiap Komponen</p>
      <p className="calib-card-sub">Korelasi sub-score terhadap hasil nyata — dasar untuk menggeser bobot.</p>
      <Table headers={["Komponen", "n", "Korelasi"]}>
        {attribution.map((a) => (
          <tr key={a.key}>
            <td>
              {a.label}
              <span className="calib-note">{a.note}</span>
            </td>
            <td className="num">{a.n}</td>
            <td className={`num ${a.meaningful ? (a.correlation > 0 ? "c-green" : "c-red") : "c-neutral"}`}>
              {fmt(a.correlation, 3)}
            </td>
          </tr>
        ))}
      </Table>

      <p className="calib-card-title" style={{ marginTop: 20 }}>Usulan Bobot</p>
      {suggestion.available ? (
        <>
          <p className="calib-card-sub">{suggestion.reason}</p>
          <Table headers={["Komponen", "Sekarang", "Usulan"]}>
            {Object.entries(suggestion.weights).map(([key, value]) => (
              <tr key={key}>
                <td>{key.replace("_WEIGHT", "")}</td>
                <td className="num">{fmt(suggestion.current[key], 3)}</td>
                <td className="num">{fmt(value, 3)}</td>
              </tr>
            ))}
          </Table>
          <p className="calib-card-sub" style={{ margin: "10px 0 0" }}>
            Tidak diterapkan otomatis. Ubah manual di lib/screener/config.js kalau Anda setuju.
          </p>
        </>
      ) : (
        <p className="calib-card-sub" style={{ margin: 0 }}>{suggestion.reason}</p>
      )}
    </div>
  );
}

function ControlCard({ control }) {
  return (
    <div className="panel-card">
      <p className="calib-card-title">Pembanding: Ambang Score 60</p>
      {control.available ? (
        <>
          <p className="calib-card-sub">{control.verdict}</p>
          <Table headers={["Kelompok", "n", "Win%", "Avg R"]}>
            <tr>
              <td>Lolos ambang</td>
              <td className="num">{control.eligible.scored}</td>
              <td className="num">{fmt(control.eligible.winRate, 1, "%")}</td>
              <td className={`num ${rClass(control.eligible.avgR)}`}>{fmt(control.eligible.avgR, 2, "R")}</td>
            </tr>
            <tr>
              <td>Kontrol (di bawah)</td>
              <td className="num">{control.control.scored}</td>
              <td className="num">{fmt(control.control.winRate, 1, "%")}</td>
              <td className={`num ${rClass(control.control.avgR)}`}>{fmt(control.control.avgR, 2, "R")}</td>
            </tr>
            <tr>
              <td><strong>Selisih</strong></td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className={`num ${rClass(control.edgeR)}`}>{fmt(control.edgeR, 2, "R")}</td>
            </tr>
          </Table>
        </>
      ) : (
        <p className="calib-card-sub" style={{ margin: 0 }}>{control.reason}</p>
      )}
    </div>
  );
}

function BreakdownCard({ title, firstHeader, data, labelMap }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v.scored > 0);
  if (entries.length === 0) return null;
  return (
    <div className="panel-card">
      <p className="calib-card-title">{title}</p>
      <Table headers={[firstHeader, "n", "Win%", "Avg R"]}>
        {entries.map(([key, v]) => (
          <tr key={key}>
            <td>{labelMap?.[key] ?? key}</td>
            <td className="num">{v.scored}</td>
            <td className="num">{fmt(v.winRate, 1, "%")}</td>
            <td className={`num ${rClass(v.avgR)}`}>{fmt(v.avgR, 2, "R")}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export default function ScreenerHistoryPage() {
  const router = useRouter();
  const { records, loaded } = usePredictions({ limit: 100 });
  const [report, setReport] = useState(null);
  const [reportStatus, setReportStatus] = useState("loading");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  // Default: hanya data aturan baru. Setup lama (v1) dievaluasi dengan jendela
  // waktu yang salah, jadi mencampurnya hanya akan mencemari korelasi.
  const [ruleset, setRuleset] = useState("2");

  useEffect(() => {
    setReportStatus("loading");
    fetch(`/api/performance?ruleset=${ruleset}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) { setReport(json); setReportStatus("ok"); } else setReportStatus("error");
      })
      .catch(() => setReportStatus("error"));
  }, [ruleset]);

  /** Unduh lewat blob, bukan <a href> langsung, supaya error server terlihat
   * sebagai pesan — bukan file CSV berisi JSON error. */
  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/predictions/export");
      if (!res.ok) throw new Error(`Server menolak (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coinkit-kalibrasi-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || "Export gagal");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Topbar title="Kalibrasi Score" />

      <div className="ruleset-toggle">
        <button className={ruleset === "2" ? "active" : ""} onClick={() => setRuleset("2")}>Aturan Baru</button>
        <button className={ruleset === "1" ? "active" : ""} onClick={() => setRuleset("1")}>Data Lama</button>
        <button className={ruleset === "all" ? "active" : ""} onClick={() => setRuleset("all")}>Gabungan</button>
      </div>
      <p className="calib-card-sub" style={{ margin: "0 0 12px" }}>
        Setup sebelum perbaikan evaluasi (Data Lama) dinilai memakai rentang waktu yang melewati horizon, jadi MFE, MAE,
        dan hasilnya membengkak. Pakai Aturan Baru untuk menilai apakah score benar-benar bekerja.
      </p>

      {reportStatus === "loading" ? <p className="detail-sub">Menghitung kalibrasi...</p> : null}
      {reportStatus === "error" ? <p className="error-banner">Gagal memuat laporan kalibrasi.</p> : null}

      {reportStatus === "ok" && report ? (
        <>
          <VerdictCard calibration={report.scoreCalibration} />
          <SummaryCard overall={report.overall} totals={report.totals} fee={report.feeAssumption} />
          <BucketTable buckets={report.scoreCalibration.buckets} />
          <ControlCard control={report.controlComparison} />
          <AttributionCard attribution={report.componentAttribution} suggestion={report.weightSuggestion} />
          <BreakdownCard title="Per Arah" firstHeader="Arah" data={report.breakdowns.byDirection} />
          <BreakdownCard title="Per Timeframe" firstHeader="TF" data={report.breakdowns.byTimeframe} />
          <BreakdownCard title="Per Jenis Hasil" firstHeader="Hasil" data={report.breakdowns.byOutcome} labelMap={OUTCOME_LABEL} />
          <BreakdownCard title="Per Alasan Keluar" firstHeader="Alasan" data={report.breakdowns.byExitReason} labelMap={EXIT_REASON_LABEL} />
          <BreakdownCard title="Per Versi Aturan" firstHeader="Versi" data={report.breakdowns.byRulesetVersion} />
        </>
      ) : null}

      <div className="section-head">
        <h2 className="section-title">Riwayat Setup</h2>
        <button className="btn-export" onClick={handleExport} disabled={exporting}>
          {exporting ? "Menyiapkan..." : "Export CSV"}
        </button>
      </div>
      {exportError ? <p className="error-banner">{exportError}</p> : null}

      {!loaded ? <p className="detail-sub">Memuat...</p> : records.length === 0 ? (
        <p className="detail-sub">Belum ada setup yang tercatat.</p>
      ) : (
        <div className="panel-card">
          <Table headers={["Symbol", "Arah", "Score", "TF", "Status", "Tanggal"]}>
            {records.map((r) => (
              <tr key={r.id} className="clickable-row" onClick={() => router.push(`/screener-history/${r.id}`)}>
                <td>{r.symbol}</td>
                <td>{r.decision}</td>
                <td className="num">{fmt(r.score, 0)}</td>
                <td>{r.timeframe}</td>
                <td><span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status}</span></td>
                <td>{new Date(r.timestamp).toLocaleDateString("id-ID")}</td>
              </tr>
            ))}
          </Table>
          <p className="calib-card-sub" style={{ margin: "10px 0 0" }}>
            CSV berisi seluruh data mentah termasuk sub-score, harga keluar, dan realized R — siap dianalisa ulang di spreadsheet.
          </p>
        </div>
      )}
    </>
  );
}

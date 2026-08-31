import { COMPONENTS } from "./calibration.js";

/**
 * CSV harus aman dibuka di Excel/Sheets. Aturannya: bungkus dengan tanda kutip
 * kalau isinya mengandung koma, kutip, atau newline; kutip di dalam digandakan.
 */
function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM supaya Excel membaca UTF-8 dengan benar
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export const EXPORT_HEADERS = [
  "id", "timestamp", "symbol", "market", "timeframe", "decision", "is_control",
  "score", "entry", "stop_loss", "tp1", "tp2", "tp3", "risk_pct",
  "momentum_score", "volume_score", "liquidity_score", "volatility_score", "breakout_score",
  "raw_score", "penalty", "direction", "structure_bias", "btc_momentum_label",
  "volume_ratio", "breakout_status", "exhaustion_status", "btc_correlation", "trail_multiplier",
  "ruleset_version", "status", "outcome", "exit_price", "exit_source", "exit_reason", "exit_at", "breakeven_activated",
  "net_pct", "realized_r", "mfe_r", "mae_r",
  "max_gain_pct", "max_drawdown_pct", "evaluated_at",
];

/**
 * Satu baris per setup, menggabungkan prediction + snapshot + outcome + hasil
 * terhitung. Sengaja mentah dan lengkap: file ini untuk dianalisa ulang di
 * spreadsheet, jadi lebih baik kelebihan kolom daripada kekurangan.
 */
export function buildExportRows(samples, rawRows) {
  const rawById = new Map(rawRows.map((r) => [r.prediction.id, r]));

  return samples.map((s) => {
    const raw = rawById.get(s.id) || {};
    const p = raw.prediction || {};
    const snap = raw.snapshot || {};
    const out = raw.outcome || {};
    const c = s.components || {};

    return [
      s.id, s.timestamp, s.symbol, s.market, s.timeframe, s.decision, s.isControl ? "1" : "0",
      s.score, p.entry, p.stop_loss, p.tp1, p.tp2, p.tp3, s.riskPct,
      ...COMPONENTS.map((comp) => c[comp.key]),
      snap.raw_score, snap.penalty, snap.direction, snap.structure_bias, snap.btc_momentum_label,
      snap.volume_ratio, snap.breakout_status, snap.exhaustion_status, p.btc_correlation, p.trail_multiplier,
      s.rulesetVersion, s.status, s.outcome, out.exit_price, s.exitSource, out.exit_reason, out.exit_at, out.breakeven_activated ? "1" : "0",
      s.netPct, s.realizedR, s.mfeR, s.maeR,
      out.maximum_gain_pct, out.maximum_drawdown_pct, out.evaluation_ended_at,
    ];
  });
}

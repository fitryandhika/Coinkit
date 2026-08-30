import test from "node:test";
import assert from "node:assert/strict";

import { computeRealizedR, roundTripFeePct, directionalPct, num } from "../lib/performance/outcomeMath.js";
import { spearman, expectancy, winRate, maxDrawdownR, longestLossStreak, isCorrelationMeaningful } from "../lib/performance/stats.js";
import { buildSamples, buildScoreCalibration, buildComponentAttribution, suggestWeights, buildControlComparison } from "../lib/performance/calibration.js";
import { PERFORMANCE_CONFIG } from "../lib/performance/config.js";

/* ---------------- helper pembuat baris ---------------- */
let seq = 0;
function makeRow({ score, realizedTargetR, market = "futures", decision = "LONG", isControl = false, components = {}, timeframe = "1h" }) {
  seq += 1;
  const entry = 100;
  const riskPct = 2;                        // SL 2% dari entry
  const stopLoss = decision === "SHORT" ? entry * 1.02 : entry * 0.98;
  // Harga keluar dibuat supaya realized R (SETELAH fee) mendekati target.
  const feePct = roundTripFeePct(market);
  const grossPct = realizedTargetR * riskPct + feePct;
  const exitPrice = decision === "SHORT" ? entry * (1 - grossPct / 100) : entry * (1 + grossPct / 100);

  return {
    prediction: {
      id: `p${seq}`, timestamp: new Date(2026, 0, 1 + (seq % 28)).toISOString(),
      symbol: "TESTUSDT", market, timeframe, decision, score,
      entry, stop_loss: stopLoss, tp1: 104, tp2: 106, tp3: 110,
      is_control: isControl,
    },
    snapshot: {
      momentum_score: components.momentum ?? 50,
      volume_score: components.volume ?? 50,
      liquidity_score: components.liquidity ?? 50,
      volatility_score: components.volatility ?? 50,
      breakout_score: components.breakout ?? 50,
    },
    outcome: {
      status: "COMPLETED", outcome: "TRAILING_STOP_HIT", exit_price: exitPrice,
      maximum_gain_pct: Math.max(0, grossPct), maximum_drawdown_pct: -1,
    },
  };
}

/* ================= realized R & fee ================= */

test("realized R memperhitungkan fee round-trip", () => {
  const p = { decision: "LONG", entry: 100, stop_loss: 98, market: "futures" };
  const o = { exit_price: 102 };                       // gross +2% = tepat 1R
  const r = computeRealizedR(p, o);
  assert.equal(r.grossPct, 2);
  assert.equal(r.netPct, 2 - 0.12);                    // 0.06% x 2 sisi
  assert.ok(r.realizedR < 1, "R bersih harus di bawah 1R karena fee");
  assert.equal(r.realizedR, Number(((2 - 0.12) / 2).toFixed(4)));
});

test("fee spot lebih besar dari futures", () => {
  assert.ok(roundTripFeePct("spot") > roundTripFeePct("futures"));
  assert.equal(roundTripFeePct("spot"), 0.2);
});

test("SHORT: harga turun = untung", () => {
  const p = { decision: "SHORT", entry: 100, stop_loss: 102, market: "futures" };
  assert.ok(computeRealizedR(p, { exit_price: 96 }).realizedR > 0);
  assert.ok(computeRealizedR(p, { exit_price: 104 }).realizedR < 0);
});

test("REGRESI: SL_HIT menghasilkan R NEGATIF (dulu maximum_r selalu positif)", () => {
  const p = { decision: "LONG", entry: 100, stop_loss: 98, market: "futures" };
  const r = computeRealizedR(p, { outcome: "SL_HIT" });
  assert.ok(r.realizedR < -1, `SL harus rugi lebih dari 1R karena fee, dapat ${r.realizedR}`);
  assert.equal(r.exitSource, "STOP_LEVEL");
});

test("EXPIRED tanpa harga keluar dilaporkan null, TIDAK ditebak dari maximum_gain", () => {
  const p = { decision: "LONG", entry: 100, stop_loss: 98, market: "futures" };
  const r = computeRealizedR(p, { outcome: "EXPIRED", maximum_gain_pct: 8 });
  assert.equal(r.realizedR, null);
  assert.equal(r.exitSource, "UNKNOWN");
});

test("directionalPct menghormati arah posisi", () => {
  assert.equal(directionalPct({ decision: "LONG", entry: 100, price: 110 }), 10);
  assert.equal(directionalPct({ decision: "SHORT", entry: 100, price: 110 }), -10);
});

/* ================= statistik ================= */

test("spearman menangkap hubungan monoton non-linear", () => {
  const xs = [1, 2, 3, 4, 5];
  assert.equal(spearman(xs, [1, 4, 9, 16, 25]), 1);
  assert.equal(spearman(xs, [25, 16, 9, 4, 1]), -1);
});

test("isCorrelationMeaningful menolak korelasi lemah pada sampel kecil", () => {
  assert.equal(isCorrelationMeaningful(0.1, 20), false);
  assert.equal(isCorrelationMeaningful(0.6, 50), true);
  assert.equal(isCorrelationMeaningful(0.9, 5), false); // sampel terlalu kecil
});

test("expectancy, winRate, drawdown, loss streak", () => {
  const rs = [1, -1, 2, -1, -1, 3];
  assert.equal(winRate(rs), 50);
  assert.equal(expectancy(rs), 0.5);
  assert.equal(longestLossStreak(rs), 2);
  assert.equal(maxDrawdownR([1, -1, -1]), 2);
});

/* ================= kalibrasi: kasus ADA edge ================= */

test("Score prediktif -> verdict EDGE, korelasi positif, bucket menaik", () => {
  const rows = [];
  for (let i = 0; i < 30; i += 1) rows.push(makeRow({ score: 62 + (i % 5), realizedTargetR: -0.6 + (i % 3) * 0.1 }));
  for (let i = 0; i < 30; i += 1) rows.push(makeRow({ score: 72 + (i % 5), realizedTargetR: 0.1 + (i % 3) * 0.1 }));
  for (let i = 0; i < 30; i += 1) rows.push(makeRow({ score: 85 + (i % 5), realizedTargetR: 0.8 + (i % 3) * 0.1 }));

  const cal = buildScoreCalibration(buildSamples(rows));
  assert.ok(cal.scoreVsResultCorrelation > 0.5, `korelasi terlalu rendah: ${cal.scoreVsResultCorrelation}`);
  assert.equal(cal.correlationMeaningful, true);
  assert.equal(cal.monotonic, true);
  assert.equal(cal.verdict.level, "EDGE");
});

/* ================= kalibrasi: kasus TIDAK ada edge ================= */

test("PENTING: score acak -> verdict NO_EDGE (mesin harus jujur, bukan cari pola)", () => {
  const rows = [];
  // hasil sengaja tidak berhubungan dengan score
  const pattern = [-1, 0.5, -0.4, 1.2, -1, 0.3, 0.9, -0.7];
  for (let i = 0; i < 96; i += 1) {
    rows.push(makeRow({ score: 60 + (i % 40), realizedTargetR: pattern[i % pattern.length] }));
  }
  const cal = buildScoreCalibration(buildSamples(rows));
  assert.equal(cal.verdict.level, "NO_EDGE");
  assert.equal(cal.correlationMeaningful, false);
});

test("Score TERBALIK terdeteksi sebagai INVERTED", () => {
  const rows = [];
  for (let i = 0; i < 40; i += 1) rows.push(makeRow({ score: 62 + (i % 4), realizedTargetR: 1.0 }));
  for (let i = 0; i < 40; i += 1) rows.push(makeRow({ score: 88 + (i % 4), realizedTargetR: -0.9 }));
  const cal = buildScoreCalibration(buildSamples(rows));
  assert.ok(cal.scoreVsResultCorrelation < 0);
  assert.equal(cal.verdict.level, "INVERTED");
});

test("Sampel sedikit -> INSUFFICIENT, tidak menyimpulkan apa pun", () => {
  const rows = [];
  for (let i = 0; i < 12; i += 1) rows.push(makeRow({ score: 60 + i, realizedTargetR: i * 0.1 }));
  const cal = buildScoreCalibration(buildSamples(rows));
  assert.equal(cal.verdict.level, "INSUFFICIENT");
});

test("Setup yang hasilnya tak terhitung dilaporkan, bukan disembunyikan", () => {
  const rows = [makeRow({ score: 70, realizedTargetR: 1 })];
  rows.push({
    prediction: { id: "x", timestamp: new Date().toISOString(), symbol: "A", market: "futures", timeframe: "1h", decision: "LONG", score: 75, entry: 100, stop_loss: 98, is_control: false },
    snapshot: {},
    outcome: { status: "COMPLETED", outcome: "EXPIRED", exit_price: null },
  });
  const cal = buildScoreCalibration(buildSamples(rows));
  assert.equal(cal.unresolved, 1);
  assert.equal(cal.sampleSize, 1);
});

/* ================= atribusi komponen & usulan bobot ================= */

test("Atribusi menemukan komponen yang benar-benar prediktif", () => {
  const rows = [];
  for (let i = 0; i < 120; i += 1) {
    const good = i % 2 === 0;
    rows.push(makeRow({
      score: 70,
      realizedTargetR: good ? 1.0 : -0.8,
      components: {
        momentum: good ? 85 : 25,     // ikut hasil -> harus terdeteksi
        liquidity: 50 + (i % 7),      // acak -> tidak boleh terdeteksi
        volume: good ? 30 : 80,       // terbalik -> harus terdeteksi negatif
      },
    }));
  }
  const attr = buildComponentAttribution(buildSamples(rows));
  const by = Object.fromEntries(attr.map((a) => [a.key, a]));

  assert.ok(by.momentum_score.correlation > 0.5 && by.momentum_score.meaningful);
  assert.ok(by.volume_score.correlation < -0.5 && by.volume_score.meaningful);
  assert.equal(by.liquidity_score.meaningful, false);
});

test("Usulan bobot menaikkan komponen prediktif & konservatif (tidak lompat penuh)", () => {
  const rows = [];
  for (let i = 0; i < 120; i += 1) {
    const good = i % 2 === 0;
    rows.push(makeRow({ score: 70, realizedTargetR: good ? 1.0 : -0.8, components: { momentum: good ? 85 : 25, liquidity: 50 + (i % 7) } }));
  }
  const attr = buildComponentAttribution(buildSamples(rows));
  const current = { MOMENTUM_WEIGHT: 0.3, VOLUME_WEIGHT: 0.2, LIQUIDITY_WEIGHT: 0.25, VOLATILITY_WEIGHT: 0.1, BREAKOUT_WEIGHT: 0.15 };
  const s = suggestWeights(attr, current);

  assert.equal(s.available, true);
  assert.ok(s.weights.MOMENTUM_WEIGHT > current.MOMENTUM_WEIGHT, "momentum harus naik");
  assert.ok(s.weights.MOMENTUM_WEIGHT < 1, "tidak boleh lompat ke bobot penuh");
  const total = Object.values(s.weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 0.01, `bobot harus ternormalisasi, dapat ${total}`);
});

test("Usulan bobot menolak jalan kalau sampel kurang", () => {
  const rows = [];
  for (let i = 0; i < 20; i += 1) rows.push(makeRow({ score: 70, realizedTargetR: i % 2 ? 1 : -1 }));
  const s = suggestWeights(buildComponentAttribution(buildSamples(rows)), { MOMENTUM_WEIGHT: 0.3 });
  assert.equal(s.available, false);
  assert.equal(s.weights, null);
});

/* ================= control group ================= */

test("Control group: ambang 60 terbukti menyaring", () => {
  const rows = [];
  for (let i = 0; i < 40; i += 1) rows.push(makeRow({ score: 75, realizedTargetR: 0.6 }));
  for (let i = 0; i < 20; i += 1) rows.push(makeRow({ score: 45, realizedTargetR: -0.4, isControl: true }));
  const c = buildControlComparison(buildSamples(rows));
  assert.equal(c.available, true);
  assert.ok(c.edgeR > 0.5);
  assert.match(c.verdict, /unggul/);
});

test("Control group: ambang 60 TIDAK memberi nilai tambah terdeteksi", () => {
  const rows = [];
  for (let i = 0; i < 40; i += 1) rows.push(makeRow({ score: 75, realizedTargetR: 0.2 }));
  for (let i = 0; i < 20; i += 1) rows.push(makeRow({ score: 45, realizedTargetR: 0.22, isControl: true }));
  const c = buildControlComparison(buildSamples(rows));
  assert.match(c.verdict, /Tidak ada beda berarti/);
});

test("Control group tidak ikut menghitung statistik utama", () => {
  const rows = [];
  for (let i = 0; i < 15; i += 1) rows.push(makeRow({ score: 75, realizedTargetR: 1 }));
  for (let i = 0; i < 15; i += 1) rows.push(makeRow({ score: 45, realizedTargetR: -1, isControl: true }));
  const c = buildControlComparison(buildSamples(rows));
  assert.ok(c.eligible.avgR > 0.9, "statistik utama harus bersih dari control");
  assert.ok(c.control.avgR < -0.9);
});

/* ================= penjaga nilai kosong dari database ================= */

test("REGRESI KRITIS: exit_price null tidak boleh dibaca sebagai harga 0", () => {
  const p = { decision: "LONG", entry: 100, stop_loss: 98, market: "futures" };
  for (const bad of [null, undefined, ""]) {
    const r = computeRealizedR(p, { outcome: "EXPIRED", exit_price: bad });
    assert.equal(r.realizedR, null, `exit_price ${JSON.stringify(bad)} harus jadi null, bukan angka`);
  }
});

test("num() menolak null/undefined/string kosong, menerima 0 yang asli", () => {
  assert.equal(num(null), null);
  assert.equal(num(undefined), null);
  assert.equal(num(""), null);
  assert.equal(num("abc"), null);
  assert.equal(num(0), 0);
  assert.equal(num("1.5"), 1.5);
});

test("Score null tidak dihitung sebagai score 0", () => {
  const rows = [{
    prediction: { id: "n", timestamp: new Date().toISOString(), symbol: "A", market: "futures", timeframe: "1h", decision: "LONG", score: null, entry: 100, stop_loss: 98, is_control: false },
    snapshot: {},
    outcome: { status: "COMPLETED", outcome: "TRAILING_STOP_HIT", exit_price: 102 },
  }];
  assert.equal(buildSamples(rows)[0].score, null);
  assert.equal(buildScoreCalibration(buildSamples(rows)).sampleSize, 0);
});

test("Sub-score null tidak dihitung sebagai 0 di atribusi", () => {
  const rows = [{
    prediction: { id: "n", timestamp: new Date().toISOString(), symbol: "A", market: "futures", timeframe: "1h", decision: "LONG", score: 70, entry: 100, stop_loss: 98, is_control: false },
    snapshot: { momentum_score: null },
    outcome: { status: "COMPLETED", outcome: "TRAILING_STOP_HIT", exit_price: 102 },
  }];
  const attr = buildComponentAttribution(buildSamples(rows));
  assert.equal(attr.find((a) => a.key === "momentum_score").n, 0);
});

import test from "node:test";
import assert from "node:assert/strict";

import { calculateScreenerScore, calculatePenalties, SCORE_VERSION } from "../lib/screener/ranking.js";
import { SCREENER_CONFIG as CFG } from "../lib/screener/config.js";
import { resolveTakeProfit } from "../lib/risk/takeProfit.js";
import { resolveTrailMultiplier } from "../lib/screener/adaptiveTrail.js";
import { classifyAsset, filterUniverseByAssetClass } from "../lib/screener/universe.js";

const GOOD = { momentumScore: 80, volumeScore: 75, liquidityScore: 80, volatilityScore: 70, breakoutScore: 85 };

/* ===================== GERBANG R:R ===================== */

test("KALIBRASI: setup dengan R:R di bawah ambang tidak diberi skor sama sekali", () => {
  const bad = calculateScreenerScore(GOOD, [], CFG, { riskReward: 0.92 });
  assert.equal(bad.finalScore, null);
  assert.equal(bad.rejectReason, "RR_GATE");

  // Setup identik dengan R:R sehat tetap dapat skor tinggi.
  const ok = calculateScreenerScore(GOOD, [], CFG, { riskReward: 2.5 });
  assert.ok(ok.finalScore >= 70, `harusnya tinggi, dapat ${ok.finalScore}`);
});

test("R:R yang tidak diketahui (null) tidak memblokir skor", () => {
  const res = calculateScreenerScore(GOOD, [], CFG, { riskReward: null });
  assert.ok(res.finalScore !== null);
});

/* ===================== GERBANG LIKUIDITAS ===================== */

test("likuiditas di bawah gerbang membatalkan setup, tidak bisa ditutupi momentum bagus", () => {
  const res = calculateScreenerScore(
    { ...GOOD, momentumScore: 100, breakoutScore: 100, liquidityScore: 10 },
    [], CFG, { riskReward: 3 }
  );
  assert.equal(res.finalScore, null);
  assert.equal(res.rejectReason, "LIQUIDITY_GATE");
});

test("likuiditas sedang menurunkan skor lewat pengali, bukan lewat bobot aditif", () => {
  const tinggi = calculateScreenerScore({ ...GOOD, liquidityScore: 90 }, [], CFG, { riskReward: 3 });
  const sedang = calculateScreenerScore({ ...GOOD, liquidityScore: 35 }, [], CFG, { riskReward: 3 });
  assert.ok(sedang.finalScore < tinggi.finalScore);
  assert.ok(sedang.liquidityFactor < 1 && sedang.liquidityFactor > 0);
});

/* ===================== DATA TIDAK LENGKAP ===================== */

test("komponen wajib yang hilang menghasilkan skor null, bukan skor hasil renormalisasi", () => {
  const res = calculateScreenerScore({ ...GOOD, momentumScore: null }, [], CFG, { riskReward: 3 });
  assert.equal(res.finalScore, null);
  assert.match(res.rejectReason, /MISSING_COMPONENT/);
});

test("komponen opsional yang hilang menurunkan coverage dan skor", () => {
  const penuh = calculateScreenerScore(GOOD, [], CFG, { riskReward: 3 });
  const sebagian = calculateScreenerScore({ ...GOOD, volatilityScore: null }, [], CFG, { riskReward: 3 });
  assert.equal(penuh.coverage, 1);
  assert.ok(sebagian.coverage < 1);
  assert.ok(sebagian.finalScore < penuh.finalScore);
});

/* ===================== PENALTI MULTIPLIKATIF ===================== */

test("penalti berskala terhadap skor, bukan pengurangan poin tetap", () => {
  const pen = calculatePenalties(
    { liquidityLabel: "HIGH", spreadPct: 0.05, volumeLabel: "NORMAL", volatilityLabel: "NORMAL", exhaustionStatus: "NORMAL", entryLabel: "OVEREXTENDED" },
    CFG
  );
  const kuat = calculateScreenerScore(GOOD, pen, CFG, { riskReward: 3 });
  const lemah = calculateScreenerScore({ momentumScore: 45, volumeScore: 40, liquidityScore: 80, volatilityScore: 40, breakoutScore: 45 }, pen, CFG, { riskReward: 3 });

  // Penalti yang sama memotong PROPORSI yang sama, jadi setup kuat kehilangan
  // lebih banyak poin daripada setup lemah...
  assert.ok(kuat.penalty > lemah.penalty);
  // ...tapi urutannya tidak pernah terbalik. Di versi lama, -20 poin absolut
  // bisa melompati seluruh sebaran skor dan menukar peringkat.
  assert.ok(kuat.finalScore > lemah.finalScore);
  assert.equal(kuat.penaltyFactor, lemah.penaltyFactor);
  assert.ok(kuat.penaltyFactor < 1);

  // Kolom `penalty` hanya memuat efek penalti — tidak tercampur pengali
  // likuiditas atau transformasi kontras.
  assert.ok(Math.abs(kuat.penalty - kuat.rawScore * (1 - kuat.penaltyFactor)) < 0.05);
});

test("skor membawa nomor versi supaya kalibrasi bisa membandingkan antar versi", () => {
  assert.equal(calculateScreenerScore(GOOD, [], CFG, { riskReward: 3 }).scoreVersion, SCORE_VERSION);
});

/* ===================== TAKE PROFIT ===================== */

test("KALIBRASI: level resistance yang terlalu dekat tidak dipakai sebagai TP1", () => {
  // Entry 100, SL 95 -> 1R = 5. Resistance 102 hanya 0.4R.
  const tp = resolveTakeProfit({ direction: "LONG", entryPrice: 100, stopLossPrice: 95, support: [], resistance: [102, 103, 140] });
  assert.ok(tp.rr.tp1 >= 1.5, `TP1 masih di R:R ${tp.rr.tp1}`);
  assert.equal(tp.rejectedTooClose, 2);
});

test("target selalu berurutan menjauh dari entry", () => {
  const long = resolveTakeProfit({ direction: "LONG", entryPrice: 100, stopLossPrice: 95, support: [], resistance: [112] });
  assert.ok(long.tp1 < long.tp2 && long.tp2 < long.tp3);

  const short = resolveTakeProfit({ direction: "SHORT", entryPrice: 100, stopLossPrice: 105, support: [99, 88, 70], resistance: [] });
  assert.ok(short.tp1 > short.tp2 && short.tp2 > short.tp3);
});

test("level struktur yang wajar tetap diprioritaskan di atas kelipatan R", () => {
  const tp = resolveTakeProfit({ direction: "LONG", entryPrice: 100, stopLossPrice: 95, support: [], resistance: [110, 120, 130] });
  assert.deepEqual([tp.tp1, tp.tp2, tp.tp3], [110, 120, 130]);
  assert.equal(tp.source, "SUPPORT_RESISTANCE");
});

/* ===================== TRAILING STOP ===================== */

test("KALIBRASI: trail tidak pernah melebihi 2.0 — data menunjukkan trail longgar mengembalikan profit", () => {
  const semua = [
    resolveTrailMultiplier({ direction: "BULLISH", btcCorrelation: 0.9, btcMomentumLabel: "STRONG_UP", config: CFG }),
    resolveTrailMultiplier({ direction: "BULLISH", btcCorrelation: 0.1, btcMomentumLabel: "STRONG_DOWN", config: CFG }),
    resolveTrailMultiplier({ direction: "BEARISH", btcCorrelation: null, btcMomentumLabel: "FLAT", config: CFG }),
  ];
  assert.ok(Math.max(...semua) <= 2, `masih ada trail > 2.0: ${semua}`);
});

/* ===================== UNIVERSE ===================== */

test("kelas aset dilabeli dengan benar (dipakai untuk kalibrasi terpisah)", () => {
  assert.equal(classifyAsset("RNVDAUSDT"), "tokenized_equity");
  assert.equal(classifyAsset("RQQQUSDT"), "tokenized_equity");
  assert.equal(classifyAsset("XAUUSDT"), "commodity");
  assert.equal(classifyAsset("JP225USDT"), "index");
});

test("kripto yang diawali huruf R tidak ikut tersaring", () => {
  for (const s of ["RENDERUSDT", "RUNEUSDT", "RAYUSDT", "RSRUSDT", "RDNTUSDT"]) {
    assert.equal(classifyAsset(s), "crypto", `${s} salah diklasifikasi`);
  }
});

test("filter universe melaporkan apa yang dibuang, bukan membuang diam-diam", () => {
  const items = ["BTCUSDT", "SOLUSDT", "RNVDAUSDT", "XAUUSDT"].map((symbol) => ({ symbol }));

  // Default: tidak menyaring apa-apa — backtest belum mendukung pembuangan.
  assert.equal(filterUniverseByAssetClass(items, { allowTokenized: true }).kept.length, 4);

  // Kalau dinyalakan, yang dibuang harus terlaporkan per kelas.
  const { kept, excludedByClass } = filterUniverseByAssetClass(items, { allowTokenized: false });
  assert.equal(kept.length, 2);
  assert.deepEqual(excludedByClass, { tokenized_equity: 1, commodity: 1 });
});

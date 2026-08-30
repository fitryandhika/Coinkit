import test from "node:test";
import assert from "node:assert/strict";

import { computeEntryQuality, computeEntryAdjustedScore, ENTRY_QUALITY_RANK } from "../lib/screener/entryQuality.js";
import { computeStructureBreak } from "../lib/screener/breakout.js";
import { atr as atrSeries } from "../lib/technical/indicators.js";
import { calculatePenalties } from "../lib/screener/ranking.js";
import { SCREENER_CONFIG as CFG } from "../lib/screener/config.js";
import { applyScreenerFilters, sortScreenerResults } from "../lib/screener/clientFilters.js";

function makeCandles(closes, { volume = 100 } = {}) {
  return closes.map((c, i) => ({
    time: i * 1000,
    open: c,
    high: c * 1.006,
    low: c * 0.994,
    close: c,
    volume,
  }));
}

/** Harga datar lalu naik tajam n candle terakhir — simulasi coin yang "sudah lari". */
function flatThenPump(flatLevel, flatCount, pumpPct, pumpCandles) {
  const out = [];
  for (let i = 0; i < flatCount; i += 1) out.push(flatLevel * (1 + (i % 3) * 0.001));
  let p = out[out.length - 1];
  const step = Math.pow(1 + pumpPct / 100, 1 / pumpCandles);
  for (let i = 0; i < pumpCandles; i += 1) {
    p *= step;
    out.push(Number(p.toFixed(6)));
  }
  return out;
}

function buildCase(closes) {
  const candles = makeCandles(closes);
  const price = closes[closes.length - 1];
  const breakout = computeStructureBreak(candles, CFG);
  const atr = atrSeries(candles, 14).slice(-1)[0];
  const tradeIdea = {
    stopLoss: { price: price - atr * 2 },
    takeProfit: { tp1: price + atr * 3 },
  };
  return { price, candles, breakout, atr, tradeIdea };
}

/* ============ Coin yang baru menembus level vs yang sudah melambung ============ */

test("baru menembus level: entry dinilai layak", () => {
  // 60 candle datar di 100, lalu naik 1.5% saja -> baru lewat previous high
  const { price, candles, breakout, atr, tradeIdea } = buildCase(flatThenPump(100, 60, 1.5, 3));
  const eq = computeEntryQuality({ price, direction: "BULLISH", candles, breakout, tradeIdea, atr, config: CFG });

  assert.ok(eq.entryScore !== null, "entryScore harus terhitung");
  assert.ok(
    ENTRY_QUALITY_RANK[eq.entryLabel] >= ENTRY_QUALITY_RANK.FAIR,
    `entry baru breakout seharusnya minimal FAIR, dapat ${eq.entryLabel} (${eq.entryScore})`
  );
  assert.equal(eq.betterEntry, null, "entry yang masih layak tidak perlu saran retest");
});

test("sudah melambung jauh: entry dinilai kemahalan", () => {
  // 60 candle datar di 100, lalu naik 45% dalam 6 candle
  const { price, candles, breakout, atr, tradeIdea } = buildCase(flatThenPump(100, 60, 45, 6));
  const eq = computeEntryQuality({ price, direction: "BULLISH", candles, breakout, tradeIdea, atr, config: CFG });

  assert.equal(eq.entryLabel, "OVEREXTENDED", `dapat ${eq.entryLabel} (score ${eq.entryScore})`);
  // Catatan: previousHigh ikut naik selama pump berlangsung, jadi chaseGapPct
  // sendirian TIDAK cukup mendeteksi pump bertahap — itulah alasan extension
  // (jarak ke EMA) dan leg (panjang kaki gerakan) dihitung terpisah.
  assert.ok(eq.chaseGapPct > 3, `chaseGapPct terlalu kecil: ${eq.chaseGapPct}`);
  assert.ok(eq.extensionAtr > CFG.ENTRY_EXTENSION_BAD_ATR, "harga harus terdeteksi jauh dari EMA");
  assert.ok(eq.legAtr > CFG.ENTRY_LEG_BAD_ATR, "kaki gerakan harus terdeteksi sudah panjang");
  assert.ok(Number.isFinite(eq.betterEntry) && eq.betterEntry < price, "harus menyarankan harga retest di bawah");
});

test("skor entry coin yang baru tembus lebih tinggi dari yang sudah lari", () => {
  const fresh = buildCase(flatThenPump(100, 60, 1.5, 3));
  const late = buildCase(flatThenPump(100, 60, 45, 6));

  const a = computeEntryQuality({ ...fresh, direction: "BULLISH", config: CFG });
  const b = computeEntryQuality({ ...late, direction: "BULLISH", config: CFG });

  assert.ok(a.entryScore > b.entryScore, `${a.entryScore} harus > ${b.entryScore}`);
});

/* ============ Sadar arah ============ */

test("sisi BEARISH: harga yang sudah jatuh dalam juga dianggap kemahalan untuk short", () => {
  const closes = flatThenPump(100, 60, 45, 6).map((v, i, arr) => (i < 60 ? v : 100 - (arr[i] - 100)));
  const candles = makeCandles(closes);
  const price = closes[closes.length - 1];
  const breakout = computeStructureBreak(candles, CFG);
  const atr = atrSeries(candles, 14).slice(-1)[0];
  const tradeIdea = { stopLoss: { price: price + atr * 2 }, takeProfit: { tp1: price - atr * 3 } };

  const eq = computeEntryQuality({ price, direction: "BEARISH", candles, breakout, tradeIdea, atr, config: CFG });
  assert.ok(
    ENTRY_QUALITY_RANK[eq.entryLabel] <= ENTRY_QUALITY_RANK.EXTENDED,
    `short setelah jatuh dalam harus EXTENDED/OVEREXTENDED, dapat ${eq.entryLabel}`
  );
  assert.ok(eq.betterEntry > price, "saran retest untuk short harus di ATAS harga sekarang");
});

test("arah NEUTRAL tidak menghasilkan penilaian entry", () => {
  const { price, candles, breakout, atr, tradeIdea } = buildCase(flatThenPump(100, 60, 5, 3));
  const eq = computeEntryQuality({ price, direction: "NEUTRAL", candles, breakout, tradeIdea, atr, config: CFG });
  assert.equal(eq.entryScore, null);
  assert.equal(eq.entryLabel, "UNKNOWN");
});

/* ============ Risk / reward ============ */

test("R:R dihitung dari harga sekarang, dan R:R jelek menurunkan skor entry", () => {
  const base = buildCase(flatThenPump(100, 60, 1.5, 3));
  const good = computeEntryQuality({
    ...base,
    direction: "BULLISH",
    tradeIdea: { stopLoss: { price: base.price - base.atr }, takeProfit: { tp1: base.price + base.atr * 3 } },
    config: CFG,
  });
  const bad = computeEntryQuality({
    ...base,
    direction: "BULLISH",
    tradeIdea: { stopLoss: { price: base.price - base.atr * 4 }, takeProfit: { tp1: base.price + base.atr * 0.5 } },
    config: CFG,
  });

  assert.ok(good.riskReward > 2, `R:R bagus harus > 2, dapat ${good.riskReward}`);
  assert.ok(bad.riskReward < 0.5, `R:R jelek harus < 0.5, dapat ${bad.riskReward}`);
  assert.ok(good.entryScore > bad.entryScore);
});

test("ATR tidak valid tidak membuat crash", () => {
  const { price, candles, breakout, tradeIdea } = buildCase(flatThenPump(100, 60, 5, 3));
  for (const atr of [null, undefined, 0, NaN]) {
    const eq = computeEntryQuality({ price, direction: "BULLISH", candles, breakout, tradeIdea, atr, config: CFG });
    assert.equal(eq.entryScore, null);
    assert.equal(eq.entryLabel, "UNKNOWN");
  }
});

/* ============ Penalti & skor gabungan ============ */

test("label entry kemahalan menambah penalti skor screener", () => {
  const none = calculatePenalties({ liquidityLabel: "HIGH", spreadPct: 0.05, volumeLabel: "HIGH", volatilityLabel: "NORMAL", exhaustionStatus: "NORMAL", entryLabel: "GOOD" }, CFG);
  const over = calculatePenalties({ liquidityLabel: "HIGH", spreadPct: 0.05, volumeLabel: "HIGH", volatilityLabel: "NORMAL", exhaustionStatus: "NORMAL", entryLabel: "OVEREXTENDED" }, CFG);

  assert.equal(none.length, 0);
  assert.equal(over.length, 1);
  assert.equal(over[0].amount, CFG.PENALTY_OVEREXTENDED_ENTRY);
});

test("entryAdjustedScore memadukan skor setup dan kelayakan harga", () => {
  assert.equal(computeEntryAdjustedScore(80, 30, CFG), 60); // 80*0.6 + 30*0.4
  assert.equal(computeEntryAdjustedScore(80, null, CFG), 80); // tanpa entryScore -> apa adanya
  assert.equal(computeEntryAdjustedScore(null, 50, CFG), null);
});

/* ============ Filter & urutan di sisi UI ============ */

const SAMPLE = [
  { symbol: "A", screenerScore: 85, entryAdjustedScore: 61, entryScore: 25, entryLabel: "OVEREXTENDED", riskReward: 0.4, volume24h: 1e7, liquidityLabel: "HIGH", spreadPct: 0.05 },
  { symbol: "B", screenerScore: 70, entryAdjustedScore: 76, entryScore: 85, entryLabel: "GOOD", riskReward: 2.8, volume24h: 1e7, liquidityLabel: "HIGH", spreadPct: 0.05 },
  { symbol: "C", screenerScore: 74, entryAdjustedScore: 66, entryScore: 54, entryLabel: "FAIR", riskReward: 1.4, volume24h: 1e7, liquidityLabel: "HIGH", spreadPct: 0.05 },
  { symbol: "D", screenerScore: 60, entryAdjustedScore: 60, entryScore: null, entryLabel: "UNKNOWN", riskReward: null, volume24h: 1e7, liquidityLabel: "HIGH", spreadPct: 0.05 },
];

test("filter default menyembunyikan setup yang kemahalan", () => {
  const out = applyScreenerFilters(SAMPLE, { entryQuality: "HIDE_OVEREXTENDED" });
  assert.deepEqual(out.map((r) => r.symbol), ["B", "C", "D"]);
});

test("filter 'hanya entry ideal' menyisakan yang GOOD saja", () => {
  const out = applyScreenerFilters(SAMPLE, { entryQuality: "GOOD_ONLY" });
  assert.deepEqual(out.map((r) => r.symbol), ["B"]);
});

test("filter minimal R:R ikut menyaring yang R:R-nya tidak diketahui", () => {
  const out = applyScreenerFilters(SAMPLE, { entryQuality: "ANY", minRiskReward: 1.5 });
  assert.deepEqual(out.map((r) => r.symbol), ["B"]);
});

test("urutan 'Entry terbaik' menaruh setup murah di atas skor mentah tertinggi", () => {
  const byRaw = sortScreenerResults(SAMPLE, "screenerScore", "desc");
  const byEntry = sortScreenerResults(SAMPLE, "entryAdjustedScore", "desc");

  assert.equal(byRaw[0].symbol, "A", "urutan lama menaruh coin kemahalan di puncak");
  assert.equal(byEntry[0].symbol, "B", "urutan baru menaruh entry paling layak di puncak");
});

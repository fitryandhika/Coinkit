import test from "node:test";
import assert from "node:assert/strict";

import { inferDirection, buildTradeIdea } from "../lib/screener/tradeIdea.js";
import { resolveStopLoss } from "../lib/risk/stopLoss.js";
import { resolveTakeProfit } from "../lib/risk/takeProfit.js";
import { SCREENER_CONFIG as CFG } from "../lib/screener/config.js";
import { computeMomentum, computeMomentumRate, describeMomentum, computeDirectionalMomentumScore } from "../lib/screener/momentum.js";
import { computeStructureBreak, computeStructureBreakScore } from "../lib/screener/breakout.js";
import { computeVolumeRatio } from "../lib/screener/volume.js";
import { calculateScreenerScore } from "../lib/screener/ranking.js";
import { toReturns, computeCorrelation } from "../lib/screener/correlation.js";

/* ---------- helper: bikin deret candle sintetis ---------- */
function makeCandles(closes, { volume = 100, lastVolume = null } = {}) {
  return closes.map((c, i) => ({
    time: i * 1000,
    open: c,
    high: c * 1.004,
    low: c * 0.996,
    close: c,
    volume: i === closes.length - 1 && lastVolume !== null ? lastVolume : volume,
  }));
}
function trend(start, pctPerCandle, n) {
  const out = [];
  let p = start;
  for (let i = 0; i < n; i += 1) {
    out.push(Number(p.toFixed(6)));
    p *= 1 + pctPerCandle / 100;
  }
  return out;
}

/* ===================== ARAH ===================== */

test("inferDirection: momentum naik + breakout -> BULLISH", () => {
  assert.equal(inferDirection({ momentumLabel: "STRONG_UP", breakoutStatus: "BREAKOUT", structureBias: "UP" }), "BULLISH");
});

test("inferDirection: momentum turun + breakdown -> BEARISH", () => {
  assert.equal(inferDirection({ momentumLabel: "STRONG_DOWN", breakoutStatus: "BREAKDOWN", structureBias: "DOWN" }), "BEARISH");
});

test("inferDirection: BARU — breakdown saja sudah cukup jadi BEARISH walau momentum datar", () => {
  assert.equal(inferDirection({ momentumLabel: "FLAT", breakoutStatus: "BREAKDOWN", structureBias: "DOWN" }), "BEARISH");
});

test("inferDirection: sinyal bertabrakan -> NEUTRAL", () => {
  assert.equal(inferDirection({ momentumLabel: "STRONG_UP", breakoutStatus: "BREAKDOWN", structureBias: "DOWN" }), "NEUTRAL");
  assert.equal(inferDirection({ momentumLabel: "FLAT", breakoutStatus: "NORMAL", structureBias: "NEUTRAL" }), "NEUTRAL");
});

/* ===================== BUG #1: SHORT DIHUKUM ===================== */

test("REGRESI: coin jatuh keras dinilai TINGGI untuk setup SHORT (dulu selalu rendah)", () => {
  const candles = makeCandles(trend(100, -1.2, 30));
  const rate = computeMomentumRate(computeMomentum(candles), CFG);
  assert.ok(rate.rate < 0, "rate harus negatif");
  assert.equal(rate.aligned, true);
  assert.equal(rate.alignedDirection, "DOWN");

  const shortScore = computeDirectionalMomentumScore(rate, "BEARISH", CFG);
  const longScore = computeDirectionalMomentumScore(rate, "BULLISH", CFG);

  assert.ok(shortScore >= 70, `skor SHORT terlalu rendah: ${shortScore}`);
  assert.ok(longScore <= 30, `skor LONG terlalu tinggi: ${longScore}`);
});

test("Simetri: kenaikan +X% untuk LONG = penurunan -X% untuk SHORT", () => {
  const up = computeMomentumRate(computeMomentum(makeCandles(trend(100, 1.2, 30))), CFG);
  const down = computeMomentumRate(computeMomentum(makeCandles(trend(100, -1.2, 30))), CFG);
  const longScore = computeDirectionalMomentumScore(up, "BULLISH", CFG);
  const shortScore = computeDirectionalMomentumScore(down, "BEARISH", CFG);
  assert.ok(Math.abs(longScore - shortScore) < 3, `tidak simetris: ${longScore} vs ${shortScore}`);
});

test("Momentum datar -> skor sekitar netral (50)", () => {
  const flat = computeMomentumRate(computeMomentum(makeCandles(new Array(30).fill(100))), CFG);
  assert.equal(computeDirectionalMomentumScore(flat, "BULLISH", CFG), 50);
});

test("Arah NEUTRAL tidak error, dinilai netral", () => {
  const rate = computeMomentumRate(computeMomentum(makeCandles(trend(100, 0.8, 20))), CFG);
  assert.equal(computeDirectionalMomentumScore(rate, "NEUTRAL", CFG), 50);
});

/* ===================== BUG #2: BREAKDOWN TIDAK ADA ===================== */

test("REGRESI: breakdown di bawah low terdeteksi (dulu selalu NORMAL)", () => {
  const closes = [...new Array(40).fill(100), 92];
  const sb = computeStructureBreak(makeCandles(closes, { volume: 100, lastVolume: 300 }), CFG);
  assert.equal(sb.status, "BREAKDOWN");
  assert.equal(sb.bias, "DOWN");
  assert.ok(sb.previousLow !== null);
});

test("Breakdown tanpa konfirmasi volume -> WEAK_BREAKDOWN", () => {
  const closes = [...new Array(40).fill(100), 92];
  const sb = computeStructureBreak(makeCandles(closes, { volume: 100, lastVolume: 50 }), CFG);
  assert.equal(sb.status, "WEAK_BREAKDOWN");
});

test("Breakout ke atas tetap berfungsi seperti sebelumnya", () => {
  const closes = [...new Array(40).fill(100), 108];
  const sb = computeStructureBreak(makeCandles(closes, { volume: 100, lastVolume: 300 }), CFG);
  assert.equal(sb.status, "BREAKOUT");
  assert.equal(sb.bias, "UP");
});

test("Skor struktur relatif arah: breakout bagus untuk LONG, buruk untuk SHORT", () => {
  const sb = computeStructureBreak(makeCandles([...new Array(40).fill(100), 108], { lastVolume: 300 }), CFG);
  assert.equal(computeStructureBreakScore(sb, "BULLISH"), 100);
  assert.equal(computeStructureBreakScore(sb, "BEARISH"), 0);
});

test("Jendela swing tidak ikut melar saat candle diperbanyak", () => {
  // 200 candle: 150 pertama sangat tinggi, 50 terakhir rendah & datar.
  const closes = [...new Array(150).fill(500), ...new Array(49).fill(100), 108];
  const sb = computeStructureBreak(makeCandles(closes, { lastVolume: 300 }), CFG);
  // Hanya BREAKOUT_LOOKBACK (40) bar terakhir yang dipakai -> tetap breakout,
  // tidak terkubur oleh high 500 dari 150 bar sebelumnya.
  assert.equal(sb.status, "BREAKOUT");
  assert.equal(sb.lookback, CFG.BREAKOUT_LOOKBACK);
});

/* ===================== AMBANG AUTO-RECORD ===================== */

test("REGRESI: setup SHORT berkualitas sekarang bisa lolos ambang auto-record >= 60", () => {
  // Simulasi coin likuid yang jebol support dengan volume besar.
  const rate = computeMomentumRate(computeMomentum(makeCandles(trend(100, -1.2, 30))), CFG);
  const direction = "BEARISH";
  const sb = computeStructureBreak(makeCandles([...new Array(40).fill(100), 92], { lastVolume: 300 }), CFG);

  const { finalScore } = calculateScreenerScore(
    {
      momentumScore: computeDirectionalMomentumScore(rate, direction, CFG),
      volumeScore: 80,
      liquidityScore: 85,
      volatilityScore: 70,
      breakoutScore: computeStructureBreakScore(sb, direction),
    },
    [],
    CFG
  );
  assert.ok(finalScore >= 60, `setup SHORT bagus masih di bawah ambang: ${finalScore}`);
});

/* ===================== BUG #3: KORELASI SELALU NULL ===================== */

test("REGRESI: korelasi BTC tidak lagi selalu null dengan CANDLE_COUNT baru", () => {
  const closes = trend(100, 0.5, CFG.CANDLE_COUNT);
  const btc = trend(50000, 0.5, CFG.CANDLE_COUNT);
  const r = toReturns(closes).slice(-CFG.CORRELATION_LOOKBACK);
  const rb = toReturns(btc).slice(-CFG.CORRELATION_LOOKBACK);
  assert.ok(r.length >= CFG.MIN_CORRELATION_SAMPLE, `sampel kurang: ${r.length}`);
  assert.notEqual(computeCorrelation(r, rb, CFG.MIN_CORRELATION_SAMPLE), null);
});

test("Konfigurasi konsisten: MIN_SAMPLE <= LOOKBACK <= CANDLE_COUNT - 1", () => {
  assert.ok(CFG.MIN_CORRELATION_SAMPLE <= CFG.CORRELATION_LOOKBACK);
  assert.ok(CFG.CORRELATION_LOOKBACK <= CFG.CANDLE_COUNT - 1);
  assert.ok(CFG.BREAKOUT_LOOKBACK < CFG.CANDLE_COUNT);
});

/* ===================== EFEK SAMPING CANDLE_COUNT ===================== */

test("Volume ratio memakai jendela tetap, tidak berubah saat candle diperbanyak", () => {
  const short = makeCandles([...new Array(20).fill(100)], { volume: 100, lastVolume: 300 });
  const long = makeCandles([...new Array(150).fill(100)], { volume: 100, lastVolume: 300 });
  const a = computeVolumeRatio(short, { lookback: CFG.VOLUME_AVG_LOOKBACK }).volumeRatio;
  const b = computeVolumeRatio(long, { lookback: CFG.VOLUME_AVG_LOOKBACK }).volumeRatio;
  assert.equal(a, b);
  assert.equal(a, 3);
});

/* ===================== TIDAK BOLEH REGRESI (perilaku lama) ===================== */

test("buildTradeIdea LONG: stop loss di bawah entry, TP di atas entry", () => {
  const idea = buildTradeIdea({
    price: 100, direction: "BULLISH", market: "futures",
    support: [95, 90], resistance: [110, 120],
    structure: { pivotLows: [92], pivotHighs: [115] }, atr: 2,
  });
  assert.equal(idea.entry, 100);
  assert.ok(idea.stopLoss.price < 100);
  assert.ok(idea.takeProfit.tp1 > 100);
});

test("buildTradeIdea SHORT: stop loss di atas entry, TP di bawah entry", () => {
  const idea = buildTradeIdea({
    price: 100, direction: "BEARISH", market: "futures",
    support: [80, 70], resistance: [105, 110],
    structure: { pivotLows: [75], pivotHighs: [108] }, atr: 2,
  });
  assert.ok(idea.stopLoss.price > 100);
  assert.ok(idea.takeProfit.tp1 < 100);
});

test("buildTradeIdea SPOT + BEARISH: tidak menghasilkan entry (spot tidak bisa short)", () => {
  const idea = buildTradeIdea({ price: 100, direction: "BEARISH", market: "spot", support: [], resistance: [], structure: {}, atr: null });
  assert.equal(idea.entry, null);
  assert.ok(idea.reason.length > 0);
});

test("buildTradeIdea NEUTRAL: tidak menghasilkan entry", () => {
  const idea = buildTradeIdea({ price: 100, direction: "NEUTRAL", market: "futures", support: [], resistance: [], structure: {}, atr: null });
  assert.equal(idea.entry, null);
});

test("resolveStopLoss LONG memprioritaskan support terdekat di bawah entry", () => {
  const sl = resolveStopLoss({ direction: "LONG", entryPrice: 100, support: [95, 90], resistance: [], structure: {}, atr: 2 });
  assert.equal(sl.price, 95);
  assert.equal(sl.source, "SUPPORT_RESISTANCE");
});

test("resolveTakeProfit LONG memprioritaskan resistance terdekat di atas entry", () => {
  const tp = resolveTakeProfit({ direction: "LONG", entryPrice: 100, stopLossPrice: 95, support: [], resistance: [110, 120, 130] });
  assert.equal(tp.tp1, 110);
  assert.equal(tp.source, "SUPPORT_RESISTANCE");
});

test("describeMomentum memakai ambang per-candle", () => {
  assert.equal(describeMomentum(2.0, CFG), "STRONG_UP");
  assert.equal(describeMomentum(-2.0, CFG), "STRONG_DOWN");
  assert.equal(describeMomentum(0.8, CFG), "MODERATE_UP");
  assert.equal(describeMomentum(0.1, CFG), "FLAT");
  assert.equal(describeMomentum(null, CFG), "UNKNOWN");
});

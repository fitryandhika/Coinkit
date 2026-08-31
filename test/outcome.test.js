import test from "node:test";
import assert from "node:assert/strict";

import { evaluateOutcome, evaluateTrailingOutcome, granularityForHorizon } from "../lib/outcome/evaluate.js";
import { horizonEndMs, nextCheckAt, isExpired } from "../lib/outcome/scheduler.js";
import { resolveStopLoss, minimumStopDistancePct } from "../lib/risk/stopLoss.js";

const HOUR = 60 * 60 * 1000;

/** Candle ringkas: c(waktuKeBerapa, high, low, close) */
function c(i, high, low, close = (high + low) / 2) {
  return { time: i * HOUR, open: close, high, low, close, volume: 1, quoteVolume: 1 };
}

/* ================= first touch ================= */

test("REGRESI: SL kena duluan lalu TP3 tersentuh belakangan -> tetap SL_HIT", () => {
  // Ini persis kasus yang salah di versi lama: rantai else-if melompat ke
  // tp3HitAt tanpa membandingkan waktunya dengan SL.
  const r = evaluateOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 104, tp2: 106, tp3: 110,
    candles: [c(1, 101, 99), c(2, 101, 97), c(3, 112, 100)],
  });
  assert.equal(r.outcome, "SL_HIT");
  assert.equal(r.exitPrice, 98);
  assert.equal(r.exitReason, "STOP_LEVEL");
  assert.equal(r.exitAt, 2 * HOUR);
});

test("Trade berhenti di sentuhan pertama — candle sesudahnya tidak dipakai", () => {
  const r = evaluateOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 104, tp2: 106, tp3: 110,
    candles: [c(1, 105, 99), c(2, 200, 190), c(3, 150, 140)],
  });
  assert.equal(r.outcome, "TP1_HIT");
  assert.equal(r.exitPrice, 104);
  assert.equal(r.candlesUsed, 1, "candle setelah exit tidak boleh ikut dihitung");
  assert.ok(r.maximumGainPct < 6, `MFE tidak boleh menyerap candle setelah exit, dapat ${r.maximumGainPct}`);
});

test("Satu candle menyentuh SL dan TP sekaligus -> diasumsikan SL duluan", () => {
  const r = evaluateOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 104, tp2: 106, tp3: 110,
    candles: [c(1, 105, 97)],
  });
  assert.equal(r.outcome, "SL_HIT");
  assert.equal(r.exitPrice, 98);
});

test("Candle penutup SL tidak menyumbang MFE (sisi untung diabaikan)", () => {
  const r = evaluateOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 200, tp2: null, tp3: null,
    candles: [c(1, 101, 99), c(2, 108, 97)],
  });
  assert.equal(r.outcome, "SL_HIT");
  assert.equal(r.maximumGainPrice, 101, "high 108 di candle exit tidak boleh jadi MFE");
});

test("SHORT: TP di bawah entry, SL di atas entry", () => {
  const r = evaluateOutcome({
    direction: "SHORT", entry: 100, stopLoss: 102, tp1: 96, tp2: 94, tp3: 90,
    candles: [c(1, 101, 99), c(2, 100, 95)],
  });
  assert.equal(r.outcome, "TP1_HIT");
  assert.equal(r.exitPrice, 96);
});

test("TP di sisi yang salah diabaikan, bukan dianggap tersentuh", () => {
  const r = evaluateOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 95, tp2: 106, tp3: null,
    candles: [c(1, 107, 99)],
  });
  assert.equal(r.outcome, "TP2_HIT", "tp1=95 di bawah entry untuk LONG harus diabaikan");
  assert.equal(r.exitPrice, 106);
});

test("Belum kena apa pun -> PENDING, tapi close terakhir dilaporkan untuk exit EXPIRED", () => {
  const r = evaluateOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 110, tp2: null, tp3: null,
    candles: [c(1, 101, 99), c(2, 102, 99.5, 101.5)],
  });
  assert.equal(r.outcome, "PENDING");
  assert.equal(r.exitPrice, null);
  assert.equal(r.windowLastClose, 101.5, "worker memakai angka ini sebagai harga keluar saat horizon habis");
});

/* ================= trailing ================= */

test("Trailing: breakeven aktif setelah 1R, keluar di trailing stop bukan SL awal", () => {
  const r = evaluateTrailingOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 120, tp2: null, tp3: null,
    trailAtr: 1, trailMultiplier: 2,
    candles: [c(1, 103, 100), c(2, 106, 104), c(3, 105, 99)],
  });
  assert.equal(r.breakevenActivated, true);
  assert.equal(r.outcome, "TRAILING_STOP_HIT");
  assert.equal(r.exitReason, "TRAILING_STOP");
  assert.ok(r.exitPrice > 100, `trailing stop harus di atas entry, dapat ${r.exitPrice}`);
});

test("Trailing: kena SL sebelum breakeven -> SL_HIT dengan harga stop awal", () => {
  const r = evaluateTrailingOutcome({
    direction: "LONG", entry: 100, stopLoss: 98, tp1: 120, tp2: null, tp3: null,
    trailAtr: 1, trailMultiplier: 2,
    candles: [c(1, 101, 99), c(2, 100, 97)],
  });
  assert.equal(r.breakevenActivated, false);
  assert.equal(r.outcome, "SL_HIT");
  assert.equal(r.exitPrice, 98);
  assert.equal(r.exitReason, "STOP_LEVEL");
});

/* ================= jendela waktu ================= */

test("Granularitas dipilih dari panjang horizon, bukan lama setup menganggur", () => {
  assert.equal(granularityForHorizon(4), "5m");
  assert.equal(granularityForHorizon(24), "15m");
  assert.equal(granularityForHorizon(48), "1h");
  assert.equal(granularityForHorizon(200), "4h");
});

test("REGRESI: jadwal cek berikutnya tidak boleh melewati akhir horizon", () => {
  const t = "2026-01-01T00:00:00.000Z";
  const end = horizonEndMs({ timestamp: t, evaluationHorizon: "24H" });
  const nearEnd = new Date(t).getTime() + 23.9 * HOUR;

  const scheduled = new Date(nextCheckAt({ timeframe: "1d", nowMs: nearEnd, horizonEnd: end })).getTime();
  assert.ok(scheduled <= end + 5 * 60 * 1000, "cek terakhir harus jatuh tepat di akhir horizon");

  const early = new Date(t).getTime() + HOUR;
  const normal = new Date(nextCheckAt({ timeframe: "1h", nowMs: early, horizonEnd: end })).getTime();
  assert.equal(normal, early + 30 * 60 * 1000, "di tengah horizon jadwal normal tidak diubah");
});

test("isExpired memakai batas horizon yang sama dengan horizonEndMs", () => {
  const t = "2026-01-01T00:00:00.000Z";
  const end = horizonEndMs({ timestamp: t, evaluationHorizon: "4H" });
  assert.equal(isExpired({ timestamp: t, evaluationHorizon: "4H", nowMs: end - 1 }), false);
  assert.equal(isExpired({ timestamp: t, evaluationHorizon: "4H", nowMs: end }), true);
});

/* ================= jarak stop minimum ================= */

test("REGRESI: stop yang terlalu dekat dilebarkan sampai batas minimum", () => {
  // Support 99.8 cuma 0.2% dari entry — dulu diterima apa adanya.
  const sl = resolveStopLoss({
    direction: "LONG", entryPrice: 100, support: [99.8], resistance: [], structure: {}, atr: 2, market: "futures",
  });
  assert.equal(sl.widened, true);
  assert.ok(sl.distancePct >= 1.6, `ATR 2 -> minimum 1.6%, dapat ${sl.distancePct}%`);
  assert.match(sl.source, /_WIDENED$/);
});

test("Stop yang sudah cukup lebar tidak diutak-atik", () => {
  const sl = resolveStopLoss({
    direction: "LONG", entryPrice: 100, support: [95, 90], resistance: [], structure: {}, atr: 2, market: "futures",
  });
  assert.equal(sl.widened, false);
  assert.equal(sl.price, 95);
  assert.equal(sl.source, "SUPPORT_RESISTANCE");
});

test("Batas minimum menjamin fee tidak memakan porsi besar dari 1R", () => {
  // Tanpa ATR, lantai fee yang berlaku: 0.12% / 0.15 = 0.8% untuk futures.
  const minFutures = minimumStopDistancePct({ entryPrice: 100, atr: null, market: "futures" });
  assert.ok(Math.abs(minFutures - 0.8) < 1e-9, `dapat ${minFutures}`);

  // Spot fee-nya lebih besar, jadi lantainya lebih tinggi.
  const minSpot = minimumStopDistancePct({ entryPrice: 100, atr: null, market: "spot" });
  assert.ok(minSpot > minFutures);

  const sl = resolveStopLoss({
    direction: "SHORT", entryPrice: 100, support: [], resistance: [100.1], structure: {}, atr: null, market: "futures",
  });
  assert.equal(sl.widened, true);
  assert.ok(sl.price > 100, "SHORT: stop harus tetap di atas entry setelah dilebarkan");
  assert.ok(Math.abs(sl.distancePct - 0.8) < 1e-9);
});

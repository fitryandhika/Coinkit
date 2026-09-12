import test from "node:test";
import assert from "node:assert/strict";

import { decideRecording, duplicateBlocks, horizonForTimeframe } from "../lib/screener/recordPolicy.js";
import { SCREENER_CONFIG as CFG } from "../lib/screener/config.js";
import { OUTCOME_CONFIG } from "../lib/outcome/config.js";

function entryOf(overrides = {}) {
  return {
    symbol: "BTCUSDT",
    screenerScore: 75,
    direction: "BULLISH",
    entryLabel: "GOOD",
    tradeIdea: { entry: 100 },
    ...overrides,
  };
}

/* ---------------- keputusan pencatatan ---------------- */

test("setup di atas ambang dicatat sebagai rekomendasi (bukan control)", () => {
  const d = decideRecording(entryOf({ screenerScore: CFG.MIN_SCORE_TO_RECORD }), CFG, () => 0.99);
  assert.equal(d.record, true);
  assert.equal(d.isControl, false);
});

test("setup tanpa score tidak dicatat, dan alasannya memakai scoreRejectReason", () => {
  const d = decideRecording(entryOf({ screenerScore: null, scoreRejectReason: "RR_GATE" }), CFG, () => 0.99);
  assert.equal(d.record, false);
  assert.equal(d.reason, "RR_GATE");
});

test("arah NEUTRAL dan setup tanpa level entry selalu dilewati", () => {
  assert.equal(decideRecording(entryOf({ direction: "NEUTRAL" }), CFG, () => 0.99).reason, "NEUTRAL_DIRECTION");
  assert.equal(decideRecording(entryOf({ tradeIdea: {} }), CFG, () => 0.99).reason, "NO_TRADE_LEVELS");
});

test("setup di bawah ambang bisa masuk control group lewat undian", () => {
  const low = entryOf({ screenerScore: CFG.CONTROL_MIN_SCORE + 1 });
  assert.equal(decideRecording(low, CFG, () => 0).isControl, true);
  assert.equal(decideRecording(low, CFG, () => 0.99).record, false);
});

test("OVEREXTENDED tidak pernah jadi rekomendasi, tapi boleh jadi control", () => {
  const over = entryOf({ entryLabel: "OVEREXTENDED", screenerScore: 90 });
  assert.equal(decideRecording(over, CFG, () => 0.99).record, false);
  const drawn = decideRecording(over, CFG, () => 0);
  assert.equal(drawn.record, true);
  assert.equal(drawn.isControl, true);
});

test("score di bawah CONTROL_MIN_SCORE tidak masuk control walau undiannya menang", () => {
  const junk = entryOf({ screenerScore: CFG.CONTROL_MIN_SCORE - 1 });
  assert.equal(decideRecording(junk, CFG, () => 0).record, false);
});

/* ---------------- dedup: inti kemacetan 6 September ---------------- */

const HOUR = 60 * 60 * 1000;

test("PENDING yang horizonnya masih berjalan tetap memblokir pencatatan ulang", () => {
  const now = Date.now();
  const existing = { timestamp: new Date(now - 2 * HOUR).toISOString(), evaluation_horizon: "24H" };
  assert.equal(duplicateBlocks(existing, now), true);
});

test("PENDING yang horizonnya sudah lewat TIDAK lagi memblokir — worker mati tidak membekukan symbol", () => {
  const now = Date.now();
  const existing = { timestamp: new Date(now - 30 * HOUR).toISOString(), evaluation_horizon: "24H" };
  assert.equal(duplicateBlocks(existing, now), false);
});

test("tepat setelah horizon habis masih diberi jeda sebelum dianggap basi", () => {
  const now = Date.now();
  const justEnded = { timestamp: new Date(now - 24 * HOUR - 60 * 1000).toISOString(), evaluation_horizon: "24H" };
  assert.equal(duplicateBlocks(justEnded, now), true);

  const past = { timestamp: new Date(now - 24 * HOUR - OUTCOME_CONFIG.STALE_PENDING_GRACE_MS - 60 * 1000).toISOString(), evaluation_horizon: "24H" };
  assert.equal(duplicateBlocks(past, now), false);
});

test("tanpa prediction aktif tidak ada yang memblokir", () => {
  assert.equal(duplicateBlocks(null, Date.now()), false);
});

test("timestamp yang tidak terbaca tetap memblokir (konservatif)", () => {
  assert.equal(duplicateBlocks({ timestamp: "bukan-tanggal", evaluation_horizon: "24H" }, Date.now()), true);
});

test("horizon 4H untuk timeframe pendek ikut terbaca saat menilai kebasian", () => {
  assert.equal(horizonForTimeframe("15m"), "4H");
  const now = Date.now();
  const existing = { timestamp: new Date(now - 6 * HOUR).toISOString(), evaluation_horizon: "4H" };
  assert.equal(duplicateBlocks(existing, now), false);
});

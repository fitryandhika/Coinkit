import test from "node:test";
import assert from "node:assert/strict";

import { inferDirection, buildTradeIdea } from "../lib/screener/tradeIdea.js";
import { resolveStopLoss } from "../lib/risk/stopLoss.js";
import { resolveTakeProfit } from "../lib/risk/takeProfit.js";

test("inferDirection: momentum naik + breakout -> BULLISH", () => {
  const direction = inferDirection({ momentumLabel: "STRONG_UP", breakoutStatus: "BREAKOUT" });
  assert.equal(direction, "BULLISH");
});

test("inferDirection: sinyal campur aduk -> NEUTRAL", () => {
  const direction = inferDirection({ momentumLabel: "STRONG_UP", breakoutStatus: "NORMAL" });
  assert.equal(direction, "BULLISH"); // momentum saja cukup untuk bullish
  const mixed = inferDirection({ momentumLabel: "FLAT", breakoutStatus: "NORMAL" });
  assert.equal(mixed, "NEUTRAL");
});

test("buildTradeIdea LONG: stop loss di bawah entry, TP di atas entry", () => {
  const idea = buildTradeIdea({
    price: 100,
    direction: "BULLISH",
    market: "futures",
    support: [95, 90],
    resistance: [110, 120],
    structure: { pivotLows: [92], pivotHighs: [115] },
    atr: 2,
  });
  assert.ok(idea.entry === 100);
  assert.ok(idea.stopLoss.price < 100);
  assert.ok(idea.takeProfit.tp1 > 100);
});

test("buildTradeIdea SHORT: stop loss di atas entry, TP di bawah entry", () => {
  const idea = buildTradeIdea({
    price: 100,
    direction: "BEARISH",
    market: "futures",
    support: [80, 70],
    resistance: [105, 110],
    structure: { pivotLows: [75], pivotHighs: [108] },
    atr: 2,
  });
  assert.ok(idea.stopLoss.price > 100);
  assert.ok(idea.takeProfit.tp1 < 100);
});

test("buildTradeIdea SPOT + BEARISH: tidak menghasilkan entry (bukan short)", () => {
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

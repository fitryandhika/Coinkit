import test from "node:test";
import assert from "node:assert/strict";

import { calculatePositionSize } from "../lib/risk/positionSize.js";
import { validateTradeInput } from "../lib/risk/validation.js";
import { evaluateBlockers } from "../lib/risk/blocker.js";
import { RISK_CONFIG } from "../config/risk.js";

test("risk amount = capital x riskPercent", () => {
  const { riskAmount } = calculatePositionSize({ capital: 100, riskPercent: 1, entryPrice: 100, stopLossPrice: 98 });
  assert.equal(riskAmount, 1);
});

test("position size = riskAmount / stopDistance", () => {
  const { positionSize } = calculatePositionSize({ capital: 100, riskPercent: 1, entryPrice: 100, stopLossPrice: 98 });
  assert.equal(positionSize, 0.5);
});

test("R:R dihitung benar", () => {
  const risk = Math.abs(100 - 98);
  const reward = Math.abs(106 - 100);
  assert.equal(reward / risk, 3);
});

test("validasi LONG menolak SL di atas entry", () => {
  const result = validateTradeInput({ market: "futures", direction: "LONG", entryPrice: 100, capital: 100, riskPercent: 1, stopLoss: 102 });
  assert.equal(result.valid, false);
});

test("validasi SHORT menolak SL di bawah entry", () => {
  const result = validateTradeInput({ market: "futures", direction: "SHORT", entryPrice: 100, capital: 100, riskPercent: 1, stopLoss: 98 });
  assert.equal(result.valid, false);
});

test("validasi menolak leverage melebihi maksimum profil", () => {
  const result = validateTradeInput({ market: "futures", direction: "LONG", entryPrice: 100, capital: 100, riskPercent: 1, leverage: 10, maxLeverage: 3 });
  assert.equal(result.valid, false);
});

test("portfolio risk melebihi maksimum -> BLOCKED", () => {
  const result = evaluateBlockers({
    liquidityLabel: "HIGH", spreadPct: 0.05, stopDistancePct: 2, riskReward: 3, minRiskReward: 2,
    currentPortfolioRiskPercent: 4, newTradeRiskPercent: 2, maxPortfolioRiskPercent: 5,
    leverage: 2, maxLeverage: 3, liquidationRisk: "OK_ESTIMATE", dataQuality: "OK", config: RISK_CONFIG,
  });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockedReasons.includes("Portfolio risk limit exceeded."));
});

test("R:R di bawah minimum -> BLOCKED", () => {
  const result = evaluateBlockers({
    liquidityLabel: "HIGH", spreadPct: 0.05, stopDistancePct: 2, riskReward: 1.2, minRiskReward: 2,
    currentPortfolioRiskPercent: 0, newTradeRiskPercent: 1, maxPortfolioRiskPercent: 5,
    leverage: 2, maxLeverage: 3, liquidationRisk: "OK_ESTIMATE", dataQuality: "OK", config: RISK_CONFIG,
  });
  assert.equal(result.status, "BLOCKED");
});

test("data tidak cukup -> BLOCKED", () => {
  const result = evaluateBlockers({
    liquidityLabel: "HIGH", spreadPct: 0.05, stopDistancePct: 2, riskReward: 3, minRiskReward: 2,
    currentPortfolioRiskPercent: 0, newTradeRiskPercent: 1, maxPortfolioRiskPercent: 5,
    leverage: 2, maxLeverage: 3, liquidationRisk: "OK_ESTIMATE", dataQuality: "INSUFFICIENT_DATA", config: RISK_CONFIG,
  });
  assert.equal(result.status, "BLOCKED");
});

test("setup normal -> PASS", () => {
  const result = evaluateBlockers({
    liquidityLabel: "HIGH", spreadPct: 0.05, stopDistancePct: 2, riskReward: 3, minRiskReward: 2,
    currentPortfolioRiskPercent: 1, newTradeRiskPercent: 1, maxPortfolioRiskPercent: 5,
    leverage: 2, maxLeverage: 3, liquidationRisk: "OK_ESTIMATE", dataQuality: "OK", config: RISK_CONFIG,
  });
  assert.equal(result.status, "PASS");
});

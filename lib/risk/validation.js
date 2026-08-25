export function validateTradeInput({ market, direction, entryPrice, capital, riskPercent, maxRiskPercent, stopLoss, takeProfit, leverage, maxLeverage }) {
  const errors = [];

  if (!capital || capital <= 0) errors.push("Capital harus lebih dari 0");
  if (!riskPercent || riskPercent <= 0) errors.push("Risk per trade harus lebih dari 0");
  if (maxRiskPercent !== undefined && riskPercent > maxRiskPercent) {
    errors.push(`Risk per trade melebihi batas wajar profil (${maxRiskPercent}%)`);
  }
  if (!entryPrice || entryPrice <= 0) errors.push("Entry price harus lebih dari 0");

  if (stopLoss !== null && stopLoss !== undefined) {
    if (stopLoss <= 0) errors.push("Stop loss harus lebih dari 0");
    if (direction === "LONG" && stopLoss >= entryPrice) errors.push("Untuk LONG, stop loss harus di bawah entry");
    if (direction === "SHORT" && stopLoss <= entryPrice) errors.push("Untuk SHORT, stop loss harus di atas entry");
  }

  if (takeProfit && typeof takeProfit === "object") {
    Object.entries(takeProfit).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (value <= 0) errors.push(`${key} harus lebih dari 0`);
      if (direction === "LONG" && value <= entryPrice) errors.push(`${key} harus di atas entry untuk LONG`);
      if (direction === "SHORT" && value >= entryPrice) errors.push(`${key} harus di bawah entry untuk SHORT`);
    });
  }

  if (market === "futures" && leverage !== undefined && leverage !== null) {
    if (leverage < 1) errors.push("Leverage minimal 1x");
    if (maxLeverage !== undefined && leverage > maxLeverage) {
      errors.push(`Leverage melebihi batas maksimum profil (${maxLeverage}x)`);
    }
  }

  return { valid: errors.length === 0, errors };
}

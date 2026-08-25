export function calculatePositionSize({ capital, riskPercent, entryPrice, stopLossPrice }) {
  if (!capital || !riskPercent || !entryPrice || !stopLossPrice) {
    return { riskAmount: null, stopDistance: null, positionSize: null, notional: null };
  }

  const riskAmount = Number((capital * (riskPercent / 100)).toFixed(8));
  const stopDistance = Math.abs(entryPrice - stopLossPrice);
  if (stopDistance <= 0) return { riskAmount, stopDistance: null, positionSize: null, notional: null };

  const positionSize = riskAmount / stopDistance;
  const notional = positionSize * entryPrice;

  return {
    riskAmount,
    stopDistance: Number(stopDistance.toFixed(8)),
    positionSize: Number(positionSize.toFixed(8)),
    notional: Number(notional.toFixed(8)),
  };
}

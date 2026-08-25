import { RISK_CONFIG } from "../../config/risk.js";
import { validateTradeInput } from "./validation.js";
import { resolveStopLoss } from "./stopLoss.js";
import { resolveTakeProfit } from "./takeProfit.js";
import { calculatePositionSize } from "./positionSize.js";
import { resolveLeverage, estimateRequiredMargin } from "./leverage.js";
import { estimateLiquidationRisk } from "./liquidation.js";
import { classifyFunding } from "./funding.js";
import { analyzeOpenInterest } from "./openInterest.js";
import { analyzeCorrelation } from "./correlation.js";
import { calculateRiskScore } from "./riskScore.js";
import { evaluateBlockers } from "./blocker.js";

function computeRiskReward(entryPrice, stopLossPrice, takeProfitPrice) {
  if (entryPrice === null || stopLossPrice === null || takeProfitPrice === null || takeProfitPrice === undefined) return null;
  const risk = Math.abs(entryPrice - stopLossPrice);
  const reward = Math.abs(takeProfitPrice - entryPrice);
  return risk > 0 ? Number((reward / risk).toFixed(4)) : null;
}

export function buildTradePlan(input) {
  const {
    symbol,
    market,
    riskProfile = "MODERATE",
    capital,
    riskPercent,
    entryPrice,
    entryType = "MARKET",
    userStopLoss = null,
    userTakeProfit = null,
    requestedLeverage = null,
    maxPortfolioRiskOverride,
    minRiskRewardOverride,
    openPositions = [],
    ticker,
    technical,
    config = RISK_CONFIG,
  } = input;

  const profile = config.PROFILES[riskProfile] || config.PROFILES[config.DEFAULT_PROFILE];
  const maxLeverage = profile.maxLeverage;
  const minRiskReward = minRiskRewardOverride ?? profile.minRiskReward;
  const maxPortfolioRiskPercent = maxPortfolioRiskOverride ?? profile.maxPortfolioRiskPercent;

  const direction = market === "spot" ? "LONG" : input.direction;
  const displayDirection = market === "spot" ? "BUY" : direction;

  const validation = validateTradeInput({
    market,
    direction,
    entryPrice,
    capital,
    riskPercent,
    maxRiskPercent: profile.riskPerTradePercent * 4,
    stopLoss: userStopLoss,
    takeProfit: userTakeProfit,
    leverage: requestedLeverage,
    maxLeverage,
  });
  if (!validation.valid) return { success: false, errors: validation.errors };

  const dataQuality = technical?.dataQuality ?? "INSUFFICIENT_DATA";

  const stopLossResolved =
    userStopLoss != null
      ? {
          price: userStopLoss,
          source: "USER_PROVIDED",
          distance: Math.abs(entryPrice - userStopLoss),
          distancePct: Number(((Math.abs(entryPrice - userStopLoss) / entryPrice) * 100).toFixed(4)),
        }
      : resolveStopLoss({ direction, entryPrice, support: technical?.support, resistance: technical?.resistance, structure: technical?.structure, atr: technical?.atrValue, config });

  const takeProfitResolved =
    userTakeProfit != null
      ? { ...userTakeProfit, source: "USER_PROVIDED" }
      : resolveTakeProfit({ direction, entryPrice, stopLossPrice: stopLossResolved.price, support: technical?.support, resistance: technical?.resistance, config });

  const { riskAmount, positionSize, notional } = calculatePositionSize({ capital, riskPercent, entryPrice, stopLossPrice: stopLossResolved.price });

  const leverageResolved = resolveLeverage({ market, requestedLeverage, profileMaxLeverage: maxLeverage });
  const requiredMargin = market === "futures" ? estimateRequiredMargin({ notional, leverage: leverageResolved.leverage }) : null;

  const liquidation =
    market === "futures"
      ? estimateLiquidationRisk({ market, direction, entryPrice, leverage: leverageResolved.leverage, stopLossPrice: stopLossResolved.price, config })
      : { liquidationPrice: null, liquidationRisk: "NOT_APPLICABLE", isEstimate: false };

  const funding = classifyFunding({ market, fundingRate: ticker?.fundingRate ?? null, direction, config });
  const openInterest = analyzeOpenInterest({ market, openInterest: ticker?.openInterest ?? null });
  const correlation = analyzeCorrelation({ symbol, openPositions, config });

  const riskRewardByTP = {
    tp1: computeRiskReward(entryPrice, stopLossResolved.price, takeProfitResolved.tp1),
    tp2: computeRiskReward(entryPrice, stopLossResolved.price, takeProfitResolved.tp2),
    tp3: computeRiskReward(entryPrice, stopLossResolved.price, takeProfitResolved.tp3),
  };

  const liquidityLabel = ticker?.liquidityLabel ?? "UNKNOWN";
  const spreadPct = ticker?.spreadPct ?? null;

  const { riskScore, riskLevel, breakdown } = calculateRiskScore(
    {
      atrPercent: technical?.atrPercent ?? null,
      liquidityLabel,
      spreadPct,
      stopDistancePct: stopLossResolved.distancePct,
      leverage: leverageResolved.leverage,
      maxLeverage,
      fundingStatus: funding.fundingStatus,
      liquidationRisk: liquidation.liquidationRisk,
    },
    config
  );

  const currentPortfolioRiskPercent = openPositions.reduce((sum, p) => sum + (p.riskPercent || 0), 0);

  const blockerResult = evaluateBlockers({
    liquidityLabel,
    spreadPct,
    stopDistancePct: stopLossResolved.distancePct,
    riskReward: riskRewardByTP.tp1,
    minRiskReward,
    currentPortfolioRiskPercent,
    newTradeRiskPercent: riskPercent,
    maxPortfolioRiskPercent,
    leverage: leverageResolved.leverage,
    maxLeverage,
    liquidationRisk: liquidation.liquidationRisk,
    dataQuality,
    config,
  });

  const warnings = [...blockerResult.warnings];
  if (funding.warning) warnings.push(funding.warning);
  if (correlation.warning) warnings.push(correlation.warning);

  return {
    success: true,
    tradePlan: {
      symbol,
      market,
      direction: displayDirection,
      entry: { price: entryPrice, type: entryType },
      stopLoss: { price: stopLossResolved.price, source: stopLossResolved.source, distancePct: stopLossResolved.distancePct },
      takeProfit: { tp1: takeProfitResolved.tp1, tp2: takeProfitResolved.tp2, tp3: takeProfitResolved.tp3, source: takeProfitResolved.source },
      capital,
      risk: { percent: riskPercent, amount: riskAmount },
      positionSize,
      notional,
      leverage: leverageResolved.leverage,
      requiredMargin,
      riskReward: riskRewardByTP,
      liquidation,
      funding,
      openInterest,
      correlation,
      fees: {
        estimatedFeeRate: config.DEFAULT_FEE_RATE_PCT,
        estimatedSlippageRate: config.DEFAULT_SLIPPAGE_RATE_PCT,
        note: "ESTIMATE — belum menggunakan data fee/slippage live dari Bitget.",
      },
      riskScore,
      riskLevel,
      riskScoreBreakdown: breakdown,
      status: blockerResult.status,
      blockedReasons: blockerResult.blockedReasons,
      warnings,
      dataQuality,
    },
  };
}

import { AI_CONFIG as DEFAULT_CONFIG } from "./config";

function breakoutScoreFor(validation) {
  return { STRONG_BREAKOUT: 90, WEAK_BREAKOUT: 55, FAILED_BREAKOUT: 20, NO_BREAKOUT: 50 }[validation] ?? 50;
}

export function calculateAIScore({ technical, screener, breakoutValidation, config = DEFAULT_CONFIG }) {
  const components = {
    screener: screener?.screenerScore ?? null,
    technical: technical.technicalScore,
    momentum: technical.scoreBreakdown.momentumScore,
    structure: technical.scoreBreakdown.structureScore,
    breakout: breakoutScoreFor(breakoutValidation),
    liquidity: screener?.liquidityScore ?? null,
    volatility: technical.scoreBreakdown.volatilityScore,
  };

  let totalWeight = 0;
  let totalScore = 0;
  Object.entries(config.SCORE_WEIGHTS).forEach(([key, weight]) => {
    const score = components[key];
    if (score === null || score === undefined) return;
    totalScore += score * weight;
    totalWeight += weight;
  });

  return { aiScore: totalWeight > 0 ? Number((totalScore / totalWeight).toFixed(2)) : null, components };
}

export function calculateConfidence({ conflicts, dataQuality, multiTimeframe, config = DEFAULT_CONFIG }) {
  let confidence = config.CONFIDENCE_BASE;
  confidence -= conflicts.length * config.CONFIDENCE_CONFLICT_PENALTY;
  if (dataQuality === "PARTIAL_DATA") confidence -= config.CONFIDENCE_PARTIAL_DATA_PENALTY;
  if (multiTimeframe?.alignment === "LOW") confidence -= config.CONFIDENCE_MULTI_TF_LOW_PENALTY;
  if (multiTimeframe?.alignment === "HIGH") confidence += config.CONFIDENCE_MULTI_TF_HIGH_BONUS;
  return Math.max(config.CONFIDENCE_MIN, Math.min(config.CONFIDENCE_MAX, Number(confidence.toFixed(2))));
}

export function scoreTier(aiScore, config = DEFAULT_CONFIG) {
  if (aiScore === null) return "UNKNOWN";
  if (aiScore >= config.SCORE_THRESHOLDS.STRONG) return "STRONG_SETUP";
  if (aiScore >= config.SCORE_THRESHOLDS.MODERATE) return "MODERATE_SETUP";
  if (aiScore >= config.SCORE_THRESHOLDS.WEAK) return "WEAK_SETUP";
  return "NO_TRADE";
}

export function resolveDecision({ market, direction, aiScore, confidence, riskPlan, exhaustion, entry, config = DEFAULT_CONFIG }) {
  const proposedDirection = market === "spot" ? "BUY" : direction;

  if (riskPlan?.status === "BLOCKED") {
    return { decision: "WAIT", reason: `Risk Engine blocked this setup: ${riskPlan.blockedReasons.join("; ")}` };
  }
  if (aiScore === null || aiScore < config.MIN_SCORE_FOR_TRADE) {
    return { decision: "WAIT", reason: "AI Score below minimum threshold for a valid setup." };
  }
  if (confidence < config.MIN_CONFIDENCE_FOR_TRADE) {
    return { decision: "WAIT", reason: "Evidence is not consistent enough to support a confident setup." };
  }
  if (exhaustion?.status === "EXHAUSTION_WARNING") {
    return { decision: "WAIT", reason: "Price appears extended; avoiding chasing an exhausted move." };
  }
  if (entry?.status === "WAIT_FOR_CONFIRMATION") {
    return { decision: "WAIT", reason: entry.reason || "Waiting for clearer entry confirmation." };
  }

  return { decision: proposedDirection, reason: null };
}

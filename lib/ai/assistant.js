import { getSpotTickers } from "@/lib/bitget/spot";
import { getFuturesTickers } from "@/lib/bitget/futures";
import { getTechnicalReport } from "@/lib/technical/analyzer";
import { buildTradePlan } from "@/lib/risk/tradePlan";
import { getMarketRegime } from "./marketRegime";
import { buildEvidence } from "./evidence";
import { detectDecisionConflicts } from "./conflict";
import { validateBreakout } from "./breakoutValidation";
import { detectPullback } from "./pullback";
import { detectExhaustionWarning } from "./exhaustionWarning";
import { resolveEntry } from "./entry";
import { calculateAIScore, calculateConfidence, scoreTier, resolveDecision } from "./decision";
import { buildReasoning } from "./reasoning";
import { buildSnapshot } from "./snapshot";
import { AI_CONFIG } from "./config";

async function fetchTickerContext(market, symbol) {
  const { tickers } = market === "futures" ? await getFuturesTickers(symbol) : await getSpotTickers(symbol);
  return tickers[0] ?? null;
}

function computeSpreadAndLiquidity(ticker) {
  if (!ticker) return { spreadPct: null, liquidityLabel: "UNKNOWN" };
  const { bid, ask, volume24h } = ticker;
  const spreadPct = bid && ask && bid > 0 ? Number((((ask - bid) / ((ask + bid) / 2)) * 100).toFixed(4)) : null;
  let liquidityLabel = "UNKNOWN";
  if (volume24h !== null && volume24h !== undefined) {
    liquidityLabel = volume24h >= 5_000_000 ? "HIGH" : volume24h >= 500_000 ? "MEDIUM" : "LOW";
  }
  return { spreadPct, liquidityLabel };
}

function determineBias({ bullishEvidence, bearishEvidence, technical }) {
  const trendBullish = technical.trend.mediumTerm === "BULLISH" || technical.trend.mediumTerm === "WEAK_BULLISH";
  const trendBearish = technical.trend.mediumTerm === "BEARISH" || technical.trend.mediumTerm === "WEAK_BEARISH";

  if (bullishEvidence.length > bearishEvidence.length && !trendBearish) return "LONG";
  if (bearishEvidence.length > bullishEvidence.length && !trendBullish) return "SHORT";
  return "NONE";
}

function partialResult({ symbol, market, decision, biasSource, aiScore, confidence, technical, screener, marketRegime, bullishEvidence, bearishEvidence, conflicts, extraReason, config }) {
  const reasoning = buildReasoning({ marketRegime, bullishEvidence, bearishEvidence, conflicts, technical, riskPlan: null });
  reasoning.decisionReason = extraReason;
  return {
    success: true,
    decision: {
      symbol, market, decision, biasSource,
      aiScore, confidence, scoreTier: scoreTier(aiScore, config),
      riskLevel: "UNKNOWN", entry: null, tradePlan: null,
      breakoutValidation: "NO_BREAKOUT", pullback: { stage: "UNCLEAR", pullbackCandidate: false, direction: null },
      exhaustion: { status: "NORMAL", flags: [] },
      reasoning, warnings: [],
      snapshot: buildSnapshot({ technical, screener, riskPlan: null, marketRegime, aiScore, confidence }),
      scoreComponents: {},
    },
  };
}

export async function generateAIDecision({
  symbol, market, direction: directionOverride = null,
  capital, riskPercent, riskProfile, leverage, timeframe = "1h", screener = null,
  config = AI_CONFIG,
}) {
  const [ticker, technical, marketRegime] = await Promise.all([
    fetchTickerContext(market, symbol),
    getTechnicalReport({ symbol, market, timeframe }),
    getMarketRegime({ market }),
  ]);

  if (technical.dataQuality === "INSUFFICIENT_DATA") {
    return {
      success: true,
      decision: {
        symbol, market, decision: "WAIT", biasSource: null,
        aiScore: null, confidence: null, scoreTier: "UNKNOWN",
        riskLevel: "UNKNOWN", entry: null, tradePlan: null,
        reasoning: { marketContext: "", bullishEvidence: [], bearishEvidence: [], conflicts: [], technicalAssessment: "", riskAssessment: "", decisionReason: "Insufficient candle data to build a reliable analysis." },
        warnings: [], snapshot: null, scoreComponents: {},
      },
    };
  }

  const { spreadPct, liquidityLabel } = computeSpreadAndLiquidity(ticker);
  const { bullishEvidence, bearishEvidence } = buildEvidence({ technical, screener });
  const conflicts = detectDecisionConflicts({ technical });

  const biasSource = directionOverride && market === "futures" ? "USER_SPECIFIED" : "EVIDENCE_DERIVED";
  const bias = directionOverride && market === "futures" ? directionOverride : determineBias({ bullishEvidence, bearishEvidence, technical });

  const baseline = calculateAIScore({ technical, screener, breakoutValidation: "NO_BREAKOUT", config });
  const confidenceBase = calculateConfidence({ conflicts, dataQuality: technical.dataQuality, multiTimeframe: technical.multiTimeframe, config });

  if (bias === "NONE") {
    return partialResult({
      symbol, market, decision: "WAIT", biasSource,
      aiScore: baseline.aiScore, confidence: confidenceBase,
      technical, screener, marketRegime, bullishEvidence, bearishEvidence, conflicts,
      extraReason: "Evidence is mixed; no clear directional bias.", config,
    });
  }

  if (market === "spot" && bias === "SHORT") {
    return partialResult({
      symbol, market, decision: "SELL", biasSource,
      aiScore: baseline.aiScore, confidence: confidenceBase,
      technical, screener, marketRegime, bullishEvidence, bearishEvidence, conflicts,
      extraReason: "Bearish evidence outweighs bullish evidence. This does not open a short — it means: consider exiting or reducing an existing Spot position.",
      config,
    });
  }

  const workingDirection = bias;
  const breakoutValidation = validateBreakout({ technical, config });
  const pullback = detectPullback({ technical });
  const exhaustion = detectExhaustionWarning({ technical, config });
  const entry = resolveEntry({ direction: workingDirection, technical, breakoutValidation, pullback, config });

  const { aiScore, components } = calculateAIScore({ technical, screener, breakoutValidation, config });

  let confidence = confidenceBase;
  const evidenceContradictsHypothesis =
    biasSource === "USER_SPECIFIED" &&
    ((workingDirection === "LONG" && bearishEvidence.length > bullishEvidence.length) ||
      (workingDirection === "SHORT" && bullishEvidence.length > bearishEvidence.length));
  if (evidenceContradictsHypothesis) confidence = Math.max(config.CONFIDENCE_MIN, confidence - config.CONFIDENCE_MISMATCH_PENALTY);

  const entryPriceForRisk = entry.zone ? Number(((entry.zone.low + entry.zone.high) / 2).toFixed(8)) : technical.price;

  const riskResult = buildTradePlan({
    symbol, market, direction: workingDirection, entryPrice: entryPriceForRisk,
    capital, riskPercent, riskProfile,
    requestedLeverage: market === "futures" ? leverage : null,
    ticker: ticker ? { bid: ticker.bid, ask: ticker.ask, volume24h: ticker.volume24h, fundingRate: ticker.fundingRate, openInterest: ticker.openInterest, spreadPct, liquidityLabel } : null,
    technical: { dataQuality: technical.dataQuality, atrValue: technical.indicators.atr, atrPercent: technical.indicators.atrPercent, support: technical.support, resistance: technical.resistance, structure: technical.structure },
  });
  const riskPlan = riskResult.success ? riskResult.tradePlan : null;

  const { decision, reason: decisionReason } = resolveDecision({ market, direction: workingDirection, aiScore, confidence, riskPlan, exhaustion, entry, config });

  const reasoning = buildReasoning({ marketRegime, bullishEvidence, bearishEvidence, conflicts, technical, riskPlan });
  reasoning.decisionReason = decisionReason || (evidenceContradictsHypothesis
    ? `Evaluated user-specified ${workingDirection} hypothesis, but evidence does not strongly support it.`
    : `Evidence favors ${workingDirection}.`);

  return {
    success: true,
    decision: {
      symbol, market, decision, biasSource,
      aiScore, confidence, scoreTier: scoreTier(aiScore, config),
      riskLevel: riskPlan?.riskLevel ?? "UNKNOWN",
      entry, tradePlan: riskPlan,
      breakoutValidation, pullback, exhaustion,
      reasoning, warnings: riskPlan?.warnings || [],
      snapshot: buildSnapshot({ technical, screener, riskPlan, marketRegime, aiScore, confidence }),
      scoreComponents: components,
    },
  };
}

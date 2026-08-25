export function buildReasoning({ marketRegime, bullishEvidence, bearishEvidence, conflicts, technical, riskPlan }) {
  const marketContext = `Market regime: ${marketRegime.regime}${marketRegime.riskTag !== "UNKNOWN" ? ` (${marketRegime.riskTag})` : ""}.`;
  const technicalAssessment = `Technical score ${technical.technicalScore ?? "—"}/100. Trend short=${technical.trend.shortTerm}, medium=${technical.trend.mediumTerm}, long=${technical.trend.longTerm}.`;
  const riskAssessment = riskPlan ? `Risk score ${riskPlan.riskScore ?? "—"}/100 (${riskPlan.riskLevel}). Status: ${riskPlan.status}.` : "No new trade plan generated for this signal.";

  return {
    marketContext,
    bullishEvidence,
    bearishEvidence,
    conflicts: conflicts.map((c) => c.reason),
    technicalAssessment,
    riskAssessment,
    decisionReason: null,
  };
}

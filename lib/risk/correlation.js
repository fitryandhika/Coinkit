import { RISK_CONFIG } from "../../config/risk.js";

export function analyzeCorrelation({ symbol, openPositions = [], config = RISK_CONFIG }) {
  const correlationGroup = config.CORRELATION_GROUPS[symbol] || "unclassified";

  const correlatedOpenCount = openPositions.filter(
    (p) => correlationGroup !== "unclassified" && (config.CORRELATION_GROUPS[p.symbol] || "unclassified") === correlationGroup
  ).length;

  return { correlationGroup, correlatedOpenCount, warning: correlatedOpenCount > 0 ? "Higher correlated exposure." : null };
}

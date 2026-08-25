export function classifyFunding({ market, fundingRate, direction, config }) {
  if (market !== "futures" || fundingRate === null || fundingRate === undefined) {
    return { fundingRate: null, fundingStatus: "UNKNOWN", warning: null };
  }

  const fundingPct = fundingRate * 100;
  const abs = Math.abs(fundingPct);

  let fundingStatus = "NORMAL";
  if (abs >= config.FUNDING_EXTREME_PCT) fundingStatus = "EXTREME";
  else if (abs >= config.FUNDING_ELEVATED_PCT) fundingStatus = "ELEVATED";

  let warning = null;
  if (fundingStatus !== "NORMAL") {
    if (direction === "LONG" && fundingPct > 0) warning = "Long positioning may be crowded.";
    else if (direction === "SHORT" && fundingPct < 0) warning = "Short positioning may be crowded.";
  }

  return { fundingRate: Number(fundingPct.toFixed(6)), fundingStatus, warning };
}

import { OUTCOME_CONFIG } from "./config";

export function isExpired({ timestamp, evaluationHorizon, nowMs, config = OUTCOME_CONFIG }) {
  const horizonHours = config.HORIZON_HOURS[evaluationHorizon] ?? config.HORIZON_HOURS[config.DEFAULT_HORIZON];
  return nowMs >= new Date(timestamp).getTime() + horizonHours * 60 * 60 * 1000;
}

export function nextCheckAt({ timeframe, nowMs, config = OUTCOME_CONFIG }) {
  const minutes = config.CHECK_INTERVAL_MINUTES[timeframe] ?? 30;
  return new Date(nowMs + minutes * 60 * 1000).toISOString();
}

export function isDueForCheck({ nextCheckAtIso, nowMs }) {
  if (!nextCheckAtIso) return true;
  return new Date(nextCheckAtIso).getTime() <= nowMs;
}

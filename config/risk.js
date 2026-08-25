export const RISK_CONFIG = {
  PROFILES: {
    CONSERVATIVE: { riskPerTradePercent: 0.5, maxLeverage: 2, minRiskReward: 2, maxPortfolioRiskPercent: 3 },
    MODERATE: { riskPerTradePercent: 1, maxLeverage: 3, minRiskReward: 2, maxPortfolioRiskPercent: 5 },
    AGGRESSIVE: { riskPerTradePercent: 2, maxLeverage: 5, minRiskReward: 2, maxPortfolioRiskPercent: 8 },
  },
  DEFAULT_PROFILE: "MODERATE",
  DEFAULT_MAX_OPEN_POSITIONS: 3,

  ATR_MULTIPLIER: 1.5,
  DEFAULT_TP_RR_MULTIPLIERS: [2, 3, 5],

  LIQUIDITY_HIGH_MIN_VOLUME: 5_000_000,
  LIQUIDITY_MEDIUM_MIN_VOLUME: 500_000,
  MAX_SPREAD_PCT: 0.5,
  MAX_STOP_DISTANCE_PCT: 15,

  FUNDING_ELEVATED_PCT: 0.05,
  FUNDING_EXTREME_PCT: 0.15,

  ASSUMED_MAINTENANCE_MARGIN_RATE_PCT: 0.5,
  LIQUIDATION_WARNING_BUFFER_PCT: 20,

  DEFAULT_FEE_RATE_PCT: 0.1,
  DEFAULT_SLIPPAGE_RATE_PCT: 0.05,

  CORRELATION_GROUPS: {
    BTCUSDT: "majors",
    ETHUSDT: "majors",
    SOLUSDT: "large-cap-alt",
    BNBUSDT: "exchange-tokens",
    XRPUSDT: "large-cap-alt",
    ADAUSDT: "large-cap-alt",
    DOGEUSDT: "meme",
  },

  RISK_SCORE_WEIGHTS: {
    volatility: 0.2,
    liquidity: 0.15,
    spread: 0.1,
    stopDistance: 0.15,
    leverage: 0.15,
    funding: 0.1,
    liquidationDistance: 0.15,
  },
  RISK_LEVEL_THRESHOLDS: { LOW: 30, MODERATE: 55, HIGH: 80 },
};

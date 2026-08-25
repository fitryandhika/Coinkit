"use client";

import { useState, useCallback } from "react";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}
function formatRR(rr) {
  return rr === null || rr === undefined ? "—" : `1 : ${rr.toFixed(2)}`;
}

export default function TradePlanPanel({ profile, initialSymbol, initialEntryPrice }) {
  const [symbol, setSymbol] = useState(initialSymbol || "BTCUSDT");
  const [direction, setDirection] = useState("LONG");
  const [entryPrice, setEntryPrice] = useState(initialEntryPrice || "");
  const [leverage, setLeverage] = useState(2);
  const [timeframe, setTimeframe] = useState("1h");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = useCallback(async () => {
    if (!symbol || !entryPrice) return;
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/risk/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          market: profile.market,
          direction: profile.market === "futures" ? direction : undefined,
          entryPrice: Number(entryPrice),
          capital: profile.capital,
          riskPercent: profile.riskPercent,
          riskProfile: profile.riskProfile,
          leverage: profile.market === "futures" ? Number(leverage) : undefined,
          maxPortfolioRisk: profile.maxPortfolioRisk,
          openPositions: profile.openPositions,
          timeframe,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.tradePlan);
        setStatus("ok");
      } else {
        setStatus("error");
        setErrorMessage(json.error || "Gagal membangun trade plan.");
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage("Tidak dapat terhubung ke server.");
    }
  }, [symbol, direction, entryPrice, leverage, timeframe, profile]);

  return (
    <div className="detail-panel">
      <h3>Trade Plan</h3>

      <div className="filter-bar">
        <div className="filter-field">
          <label>Symbol</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BTCUSDT" />
        </div>
        {profile.market === "futures" ? (
          <div className="filter-field">
            <label>Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </div>
        ) : null}
        <div className="filter-field">
          <label>Entry Price</label>
          <input type="number" min="0" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00" />
        </div>
        {profile.market === "futures" ? (
          <div className="filter-field">
            <label>Leverage</label>
            <input type="number" min="1" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
          </div>
        ) : null}
        <div className="filter-field">
          <label>Timeframe</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            {["5m", "15m", "1h", "4h", "1d"].map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="chip active" onClick={handleSubmit} disabled={status === "loading"}>
        {status === "loading" ? "Menghitung..." : "Buat Trade Plan"}
      </button>

      {status === "error" ? <p className="error-banner">{errorMessage}</p> : null}
      {status === "ok" && result ? <TradePlanResult plan={result} /> : null}
    </div>
  );
}

function TradePlanResult({ plan }) {
  const statusColor = plan.status === "PASS" ? "#16c784" : plan.status === "WARNING" ? "#f0b90b" : "#ea3943";

  return (
    <div className="trade-plan-result">
      <div className="detail-grid">
        <div><span>Symbol</span><strong>{plan.symbol}</strong></div>
        <div><span>Direction</span><strong>{plan.direction}</strong></div>
        <div><span>Entry</span><strong>${formatNumber(plan.entry.price, { maximumFractionDigits: 8 })}</strong></div>
        <div><span>Stop Loss</span><strong>${formatNumber(plan.stopLoss.price, { maximumFractionDigits: 8 })} <em>({plan.stopLoss.source})</em></strong></div>
        <div><span>TP1</span><strong>${formatNumber(plan.takeProfit.tp1, { maximumFractionDigits: 8 })}</strong></div>
        <div><span>TP2</span><strong>${formatNumber(plan.takeProfit.tp2, { maximumFractionDigits: 8 })}</strong></div>
        <div><span>TP3</span><strong>${formatNumber(plan.takeProfit.tp3, { maximumFractionDigits: 8 })}</strong></div>
        <div><span>Risk</span><strong>${formatNumber(plan.risk.amount, { maximumFractionDigits: 2 })} ({plan.risk.percent}%)</strong></div>
        <div><span>Position Size</span><strong>{formatNumber(plan.positionSize, { maximumFractionDigits: 6 })}</strong></div>
        <div><span>Notional</span><strong>${formatNumber(plan.notional, { maximumFractionDigits: 2 })}</strong></div>
        {plan.leverage ? <div><span>Leverage</span><strong>{plan.leverage}x</strong></div> : null}
        {plan.requiredMargin !== null ? <div><span>Est. Margin</span><strong>${formatNumber(plan.requiredMargin, { maximumFractionDigits: 2 })}</strong></div> : null}
      </div>

      <h4 className="section-title">Risk / Reward</h4>
      <div className="detail-grid">
        <div><span>TP1</span><strong>{formatRR(plan.riskReward.tp1)}</strong></div>
        <div><span>TP2</span><strong>{formatRR(plan.riskReward.tp2)}</strong></div>
        <div><span>TP3</span><strong>{formatRR(plan.riskReward.tp3)}</strong></div>
      </div>

      {plan.market === "futures" ? (
        <>
          <h4 className="section-title">Futures Context</h4>
          <div className="detail-grid">
            <div><span>Liquidation (estimate)</span><strong>{formatNumber(plan.liquidation.liquidationPrice, { maximumFractionDigits: 8 })} · {plan.liquidation.liquidationRisk}</strong></div>
            <div><span>Funding</span><strong>{plan.funding.fundingRate === null ? "—" : `${plan.funding.fundingRate}%`} · {plan.funding.fundingStatus}</strong></div>
            <div><span>Open Interest</span><strong>{formatNumber(plan.openInterest.openInterest, { maximumFractionDigits: 0 })}</strong></div>
            <div><span>Correlation Group</span><strong>{plan.correlation.correlationGroup}</strong></div>
          </div>
          {plan.liquidation.assumption ? <p className="score-note">{plan.liquidation.assumption}</p> : null}
        </>
      ) : null}

      <p className="score-note">Fee: {plan.fees.estimatedFeeRate}% · Slippage: {plan.fees.estimatedSlippageRate}% — {plan.fees.note}</p>

      <div className="detail-score">
        <h4>Risk Score: {formatNumber(plan.riskScore, { maximumFractionDigits: 0 })}/100 · {plan.riskLevel}</h4>
        <p className="score-note" style={{ color: statusColor, fontWeight: 600 }}>Status: {plan.status}</p>
      </div>

      {plan.blockedReasons?.length > 0 ? (
        <div className="detail-reasons"><h4>Blocked Reasons</h4><ul>{plan.blockedReasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
      ) : null}

      {plan.warnings?.length > 0 ? (
        <div className="detail-reasons"><h4>Warnings</h4><ul>{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
      ) : (
        <p className="detail-sub">Warnings: None</p>
      )}
    </div>
  );
}

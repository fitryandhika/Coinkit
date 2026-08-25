"use client";

import { useState, useCallback } from "react";
import ManualExecutionChecklist from "./ManualExecutionChecklist";
import TradeJournalForm from "./TradeJournalForm";

function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", options);
}
function formatRR(rr) {
  return rr === null || rr === undefined ? "—" : `1 : ${rr.toFixed(2)}`;
}

const DECISION_COLOR = { LONG: "#16c784", BUY: "#16c784", SHORT: "#ea3943", SELL: "#ea3943", WAIT: "#f0b90b" };

export default function AITradingAssistantPanel({ profile, initialSymbol, addPrediction, markAction, onJournalSaved }) {
  const [symbol, setSymbol] = useState(initialSymbol || "BTCUSDT");
  const [direction, setDirection] = useState("");
  const [timeframe, setTimeframe] = useState("1h");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [predictionId, setPredictionId] = useState(null);
  const [actionTaken, setActionTaken] = useState(null);
  const [showJournalForm, setShowJournalForm] = useState(false);

  const handleAnalyze = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    setResult(null);
    setPredictionId(null);
    setActionTaken(null);
    setShowJournalForm(false);

    try {
      const res = await fetch("/api/ai/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol, market: profile.market,
          direction: profile.market === "futures" && direction ? direction : undefined,
          capital: profile.capital, riskPercent: profile.riskPercent, riskProfile: profile.riskProfile,
          leverage: profile.market === "futures" ? 2 : undefined,
          timeframe,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.decision);
        setStatus("ok");
        try {
          const id = await addPrediction({ ...json.decision, symbol, market: profile.market, timeframe });
          setPredictionId(id);
        } catch (err) {
          setErrorMessage("Analisis berhasil, tapi gagal menyimpan ke history.");
        }
      } else {
        setStatus("error");
        setErrorMessage(json.error || "Gagal menghasilkan analisis AI.");
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage("Tidak dapat terhubung ke server.");
    }
  }, [symbol, direction, timeframe, profile, addPrediction]);

  const handleAction = async (action) => {
    if (!predictionId) return;
    setActionTaken(action);
    if (action === "TAKEN") setShowJournalForm(true);
    else await markAction(predictionId, "SKIPPED");
  };

  return (
    <div className="detail-panel">
      <h3>AI Trading Assistant</h3>

      <div className="filter-bar">
        <div className="filter-field"><label>Symbol</label><input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BTCUSDT" /></div>
        {profile.market === "futures" ? (
          <div className="filter-field">
            <label>Hypothesis (optional)</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="">Auto (AI decides)</option>
              <option value="LONG">Evaluate LONG</option>
              <option value="SHORT">Evaluate SHORT</option>
            </select>
          </div>
        ) : null}
        <div className="filter-field">
          <label>Timeframe</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            {["5m", "15m", "1h", "4h", "1d"].map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </div>
      </div>

      <button className="chip active" onClick={handleAnalyze} disabled={status === "loading"}>
        {status === "loading" ? "Menganalisis..." : "Analyze"}
      </button>

      {status === "error" ? <p className="error-banner">{errorMessage}</p> : null}

      {status === "ok" && result ? (
        <>
          <div className="ai-decision-header" style={{ borderColor: DECISION_COLOR[result.decision] }}>
            <span className="detail-sub">{result.symbol} · {result.market.toUpperCase()}</span>
            <div className="ai-decision-badge" style={{ color: DECISION_COLOR[result.decision] }}>{result.decision}</div>
            <div className="detail-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div><span>Score</span><strong>{formatNumber(result.aiScore, { maximumFractionDigits: 0 })}/100</strong></div>
              <div><span>Confidence</span><strong>{formatNumber(result.confidence, { maximumFractionDigits: 0 })}/100</strong></div>
              <div><span>Risk</span><strong>{result.riskLevel}</strong></div>
            </div>
          </div>

          {result.tradePlan ? (
            <>
              <h4 className="section-title">Trade Plan</h4>
              <div className="detail-grid">
                <div><span>Entry</span><strong>{result.entry?.zone ? `${formatNumber(result.entry.zone.low, { maximumFractionDigits: 8 })}–${formatNumber(result.entry.zone.high, { maximumFractionDigits: 8 })}` : formatNumber(result.tradePlan.entry.price, { maximumFractionDigits: 8 })}</strong></div>
                <div><span>SL</span><strong>{formatNumber(result.tradePlan.stopLoss.price, { maximumFractionDigits: 8 })}</strong></div>
                <div><span>TP1</span><strong>{formatNumber(result.tradePlan.takeProfit.tp1, { maximumFractionDigits: 8 })}</strong></div>
                <div><span>TP2</span><strong>{formatNumber(result.tradePlan.takeProfit.tp2, { maximumFractionDigits: 8 })}</strong></div>
                <div><span>TP3</span><strong>{formatNumber(result.tradePlan.takeProfit.tp3, { maximumFractionDigits: 8 })}</strong></div>
                <div><span>Position Size</span><strong>{formatNumber(result.tradePlan.positionSize, { maximumFractionDigits: 6 })}</strong></div>
                {result.tradePlan.leverage ? <div><span>Leverage</span><strong>{result.tradePlan.leverage}x (suggested)</strong></div> : null}
              </div>

              <h4 className="section-title">Risk / Reward</h4>
              <div className="detail-grid">
                <div><span>TP1</span><strong>{formatRR(result.tradePlan.riskReward.tp1)}</strong></div>
                <div><span>TP2</span><strong>{formatRR(result.tradePlan.riskReward.tp2)}</strong></div>
                <div><span>TP3</span><strong>{formatRR(result.tradePlan.riskReward.tp3)}</strong></div>
              </div>
            </>
          ) : (
            <p className="detail-sub">Tidak ada trade plan baru untuk sinyal ini.</p>
          )}

          <h4 className="section-title">AI Reasoning</h4>
          <p className="detail-sub">{result.reasoning?.marketContext}</p>
          <p className="detail-sub">{result.reasoning?.technicalAssessment}</p>
          <p className="detail-sub">{result.reasoning?.riskAssessment}</p>
          {result.reasoning?.bullishEvidence?.length > 0 ? <ul className="score-breakdown">{result.reasoning.bullishEvidence.map((e) => <li key={e}>✓ {e}</li>)}</ul> : null}
          {result.reasoning?.bearishEvidence?.length > 0 ? <ul className="score-breakdown">{result.reasoning.bearishEvidence.map((e) => <li key={e}>✗ {e}</li>)}</ul> : null}
          {result.reasoning?.conflicts?.length > 0 ? (
            <div className="detail-reasons"><h4>Conflicts</h4><ul>{result.reasoning.conflicts.map((c) => <li key={c}>{c}</li>)}</ul></div>
          ) : null}
          <p className="detail-sub"><em>{result.reasoning?.decisionReason}</em></p>

          {result.warnings?.length > 0 ? (
            <div className="detail-reasons"><h4>Warnings</h4><ul>{result.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul></div>
          ) : null}

          <ManualExecutionChecklist result={result} />

          <h4 className="section-title">Manual Action</h4>
          <div className="chip-group">
            <button className={actionTaken === "TAKEN" ? "chip active" : "chip"} onClick={() => handleAction("TAKEN")} disabled={!predictionId || !!actionTaken}>TRADE TAKEN</button>
            <button className={actionTaken === "SKIPPED" ? "chip active" : "chip"} onClick={() => handleAction("SKIPPED")} disabled={!predictionId || !!actionTaken}>SKIPPED</button>
          </div>
          {actionTaken === "SKIPPED" ? <p className="detail-sub">Prediction disimpan sebagai SKIPPED untuk evaluasi nanti.</p> : null}

          {showJournalForm && predictionId ? (
            <TradeJournalForm onSave={async (journalData) => { await onJournalSaved(predictionId, journalData); setShowJournalForm(false); }} />
          ) : null}
        </>
      ) : null}

      <p className="detail-sub" style={{ marginTop: 12 }}>
        CryptoAI tidak pernah mengeksekusi trade. Semua BUY/SELL/LONG/SHORT dilakukan manual oleh Anda di Bitget.
      </p>
    </div>
  );
}

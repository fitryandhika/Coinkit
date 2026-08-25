"use client";

import { useState } from "react";

const OUTCOME_OPTIONS = ["WIN", "LOSS", "BREAKEVEN", "EXPIRED", "MANUAL_EXIT", "STOPPED", "TAKE_PROFIT", "UNKNOWN"];

export default function TradeJournalForm({ onSave }) {
  const [form, setForm] = useState({
    actualEntry: "", actualExit: "", actualStopLoss: "", actualTakeProfit: "",
    positionSize: "", leverage: "", tradingFee: "", result: "UNKNOWN",
    pnl: "", maxGain: "", maxDrawdown: "", notes: "",
  });

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const toNumberOrNull = (v) => (v === "" ? null : Number(v));

  const handleSubmit = () => {
    onSave({
      actualEntry: toNumberOrNull(form.actualEntry),
      actualExit: toNumberOrNull(form.actualExit),
      actualStopLoss: toNumberOrNull(form.actualStopLoss),
      actualTakeProfit: toNumberOrNull(form.actualTakeProfit),
      positionSize: toNumberOrNull(form.positionSize),
      leverage: toNumberOrNull(form.leverage),
      tradingFee: toNumberOrNull(form.tradingFee),
      result: form.result,
      pnl: toNumberOrNull(form.pnl),
      maxGain: toNumberOrNull(form.maxGain),
      maxDrawdown: toNumberOrNull(form.maxDrawdown),
      notes: form.notes,
      recordedAt: Date.now(),
    });
  };

  return (
    <div className="detail-panel journal-form">
      <h4 className="section-title">Manual Trade Journal</h4>
      <div className="filter-bar screener-filters">
        <div className="filter-field"><label>Actual Entry</label><input type="number" value={form.actualEntry} onChange={(e) => update({ actualEntry: e.target.value })} /></div>
        <div className="filter-field"><label>Actual Exit</label><input type="number" value={form.actualExit} onChange={(e) => update({ actualExit: e.target.value })} /></div>
        <div className="filter-field"><label>Actual SL</label><input type="number" value={form.actualStopLoss} onChange={(e) => update({ actualStopLoss: e.target.value })} /></div>
        <div className="filter-field"><label>Actual TP</label><input type="number" value={form.actualTakeProfit} onChange={(e) => update({ actualTakeProfit: e.target.value })} /></div>
        <div className="filter-field"><label>Position Size</label><input type="number" value={form.positionSize} onChange={(e) => update({ positionSize: e.target.value })} /></div>
        <div className="filter-field"><label>Leverage</label><input type="number" value={form.leverage} onChange={(e) => update({ leverage: e.target.value })} /></div>
        <div className="filter-field"><label>Trading Fee</label><input type="number" value={form.tradingFee} onChange={(e) => update({ tradingFee: e.target.value })} /></div>
        <div className="filter-field">
          <label>Result</label>
          <select value={form.result} onChange={(e) => update({ result: e.target.value })}>
            {OUTCOME_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="filter-field"><label>P/L</label><input type="number" value={form.pnl} onChange={(e) => update({ pnl: e.target.value })} /></div>
        <div className="filter-field"><label>Max Gain (%)</label><input type="number" value={form.maxGain} onChange={(e) => update({ maxGain: e.target.value })} /></div>
        <div className="filter-field"><label>Max Drawdown (%)</label><input type="number" value={form.maxDrawdown} onChange={(e) => update({ maxDrawdown: e.target.value })} /></div>
      </div>
      <div className="filter-field" style={{ width: "100%" }}>
        <label>Notes</label>
        <textarea value={form.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} className="journal-notes" />
      </div>
      <button className="chip active" onClick={handleSubmit} style={{ marginTop: 8 }}>Save Journal Entry</button>
    </div>
  );
}

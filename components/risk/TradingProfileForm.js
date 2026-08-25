"use client";

const RISK_PROFILE_NAMES = ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"];

export default function TradingProfileForm({ profile, onChange }) {
  return (
    <div className="detail-panel">
      <h3>Trading Profile</h3>

      <div className="chip-group">
        <span className="chip-group-label">Market</span>
        <button className={profile.market === "spot" ? "chip active" : "chip"} onClick={() => onChange({ market: "spot" })}>SPOT</button>
        <button className={profile.market === "futures" ? "chip active" : "chip"} onClick={() => onChange({ market: "futures" })}>FUTURES</button>
      </div>

      <div className="chip-group">
        <span className="chip-group-label">Risk</span>
        {RISK_PROFILE_NAMES.map((name) => (
          <button key={name} className={profile.riskProfile === name ? "chip active" : "chip"} onClick={() => onChange({ riskProfile: name })}>
            {name}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label>Capital ($)</label>
          <input type="number" min="0" value={profile.capital} onChange={(e) => onChange({ capital: Number(e.target.value) || 0 })} />
        </div>
        <div className="filter-field">
          <label>Risk per Trade (%)</label>
          <input type="number" min="0" step="0.1" value={profile.riskPercent} onChange={(e) => onChange({ riskPercent: Number(e.target.value) || 0 })} />
        </div>
        <div className="filter-field">
          <label>Max Positions</label>
          <input type="number" min="1" value={profile.maxOpenPositions} onChange={(e) => onChange({ maxOpenPositions: Number(e.target.value) || 1 })} />
        </div>
        <div className="filter-field">
          <label>Max Portfolio Risk (%)</label>
          <input type="number" min="0" step="0.1" value={profile.maxPortfolioRisk} onChange={(e) => onChange({ maxPortfolioRisk: Number(e.target.value) || 0 })} />
        </div>
      </div>
    </div>
  );
}

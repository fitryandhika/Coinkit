"use client";

const LIQUIDITY_OPTIONS = ["ANY", "LOW", "MEDIUM", "HIGH"];

export default function ScreenerFilters({ filters, onChange }) {
  const update = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="filter-bar screener-filters">
      <div className="filter-field">
        <label>Min. Score</label>
        <input type="number" min="0" max="100" value={filters.minScore} onChange={(e) => update({ minScore: Number(e.target.value) || 0 })} />
      </div>
      <div className="filter-field">
        <label>Min. Volume</label>
        <input type="number" min="0" value={filters.minVolume} onChange={(e) => update({ minVolume: Number(e.target.value) || 0 })} />
      </div>
      <div className="filter-field">
        <label>Min. Liquidity</label>
        <select value={filters.minLiquidity} onChange={(e) => update({ minLiquidity: e.target.value })}>
          {LIQUIDITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label>Max. Spread (%)</label>
        <input type="number" min="0" step="0.01" value={filters.maxSpread ?? ""} placeholder="Tanpa batas" onChange={(e) => update({ maxSpread: e.target.value === "" ? null : Number(e.target.value) })} />
      </div>
    </div>
  );
}

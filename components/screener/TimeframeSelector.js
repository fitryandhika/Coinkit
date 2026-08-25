"use client";

export default function TimeframeSelector({ timeframe, onChange, options }) {
  return (
    <div className="chip-group">
      <span className="chip-group-label">Timeframe</span>
      {options.map((tf) => (
        <button key={tf} className={timeframe === tf ? "chip active" : "chip"} onClick={() => onChange(tf)}>
          {tf}
        </button>
      ))}
    </div>
  );
}

"use client";

const OPTIONS = [10, 20, 50];

export default function TopCountSelector({ topCount, onChange }) {
  return (
    <div className="chip-group">
      <span className="chip-group-label">Top</span>
      {OPTIONS.map((n) => (
        <button key={n} className={topCount === n ? "chip active" : "chip"} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

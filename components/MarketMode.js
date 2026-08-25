"use client";

export default function MarketMode({ mode, onChange }) {
  return (
    <div className="market-mode">
      <button className={mode === "spot" ? "active" : ""} onClick={() => onChange("spot")}>
        SPOT
      </button>
      <button className={mode === "futures" ? "active" : ""} onClick={() => onChange("futures")}>
        FUTURES
      </button>
    </div>
  );
}

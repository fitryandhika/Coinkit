"use client";

export default function ModeSwitch({ mode, onChange }) {
  return (
    <div className="mode-switch">
      <div className={`mode-switch-thumb ${mode === "futures" ? "right" : "left"}`} />
      <button
        className={mode === "spot" ? "mode-switch-btn active" : "mode-switch-btn"}
        onClick={() => onChange("spot")}
      >
        SPOT
      </button>
      <button
        className={mode === "futures" ? "mode-switch-btn active" : "mode-switch-btn"}
        onClick={() => onChange("futures")}
      >
        FUTURES
      </button>
    </div>
  );
}

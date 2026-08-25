"use client";

const OVERLAY_TABS = ["MA", "EMA", "BOLL"];
const SUB_TABS = ["VOL", "MACD", "RSI"];

export default function IndicatorTabRow({ overlay, onOverlayChange, subIndicator, onSubChange }) {
  return (
    <div className="indicator-tab-row">
      {OVERLAY_TABS.map((t) => (
        <button
          key={t}
          className={overlay === t ? "indicator-tab active" : "indicator-tab"}
          onClick={() => onOverlayChange(overlay === t ? "NONE" : t)}
        >
          {t}
        </button>
      ))}
      <span className="indicator-tab-divider" />
      {SUB_TABS.map((t) => (
        <button
          key={t}
          className={subIndicator === t ? "indicator-tab active" : "indicator-tab"}
          onClick={() => onSubChange(subIndicator === t ? null : t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

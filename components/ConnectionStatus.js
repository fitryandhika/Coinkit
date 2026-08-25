"use client";

const STATUS_CONFIG = {
  "ws-connected": { color: "#16c784", label: "🟢 Connected" },
  "rest-connected": { color: "#16c784", label: "🟢 Connected" },
  "rest-fallback": { color: "#f0b90b", label: "🟡 WebSocket disconnected — using REST fallback" },
  connecting: { color: "#f0b90b", label: "🟡 Connecting..." },
  error: { color: "#ea3943", label: "🔴 Market data temporarily unavailable." },
};

export default function ConnectionStatus({ status, lastUpdate }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.connecting;
  return (
    <div className="connection-status">
      <span className="dot" style={{ backgroundColor: config.color }} />
      <span>{config.label}</span>
      {lastUpdate ? <span className="ts">· update {new Date(lastUpdate).toLocaleTimeString("id-ID")}</span> : null}
    </div>
  );
}

"use client";

import { Clock } from "lucide-react";

const STATUS_CONFIG = {
  "ws-connected": { color: "#16c784", label: "Terhubung" },
  "rest-connected": { color: "#16c784", label: "Terhubung" },
  "rest-fallback": { color: "#f0b90b", label: "WebSocket Terputus — Menggunakan Cadangan REST" },
  connecting: { color: "#f0b90b", label: "Menghubungkan..." },
  error: { color: "#ea3943", label: "Data Pasar Sementara Tidak Tersedia" },
};

export default function ConnectionStatus({ status, lastUpdate }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.connecting;
  return (
    <div className="connection-status">
      <span className="dot" style={{ backgroundColor: config.color }} />
      <span>{config.label}</span>
      {lastUpdate ? (
        <span className="ts">
          <Clock size={11} className="ts-icon" />
          Diperbarui {new Date(lastUpdate).toLocaleTimeString("id-ID")}
        </span>
      ) : null}
    </div>
  );
}

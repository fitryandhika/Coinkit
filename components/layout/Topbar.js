"use client";

import ModeSwitch from "@/components/ModeSwitch";
import ConnectionStatus from "@/components/ConnectionStatus";

export default function Topbar({ title, mode, onModeChange, connectionStatus, lastUpdate }) {
  return (
    <header className="app-topbar-v2">
      <div className="app-topbar-row">
        <span className="app-logo-text">
          COIN<span className="app-logo-accent">KIT</span>
        </span>
        {mode ? <ModeSwitch mode={mode} onChange={onModeChange} compact /> : null}
      </div>

      {title ? <h1 className="page-title">{title}</h1> : null}

      {connectionStatus ? (
        <div className="connection-status-bar panel-card">
          <ConnectionStatus status={connectionStatus} lastUpdate={lastUpdate} />
        </div>
      ) : null}
    </header>
  );
}

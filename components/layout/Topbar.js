"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import ModeSwitch from "@/components/ModeSwitch";
import ConnectionStatus from "@/components/ConnectionStatus";

export default function Topbar({ title, mode, onModeChange, connectionStatus, lastUpdate, onSearchSymbol, showSearch = true }) {
  const [searchValue, setSearchValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const symbol = searchValue.trim().toUpperCase();
    if (!symbol || !onSearchSymbol) return;
    onSearchSymbol(symbol);
    setSearchValue("");
  };

  return (
    <header className="app-topbar-v2">
      <div className="app-topbar-row">
        <span className="app-logo-text">
          COIN<span className="app-logo-accent">KIT</span>
        </span>
        {showSearch && onSearchSymbol ? (
          <form className="app-search" onSubmit={handleSubmit}>
            <Search size={16} />
            <input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Cari symbol..." />
          </form>
        ) : null}
      </div>

      {title ? <h1 className="page-title">{title}</h1> : null}

      {mode ? <ModeSwitch mode={mode} onChange={onModeChange} /> : null}

      {connectionStatus ? (
        <div className="connection-status-bar">
          <ConnectionStatus status={connectionStatus} lastUpdate={lastUpdate} />
        </div>
      ) : null}
    </header>
  );
}

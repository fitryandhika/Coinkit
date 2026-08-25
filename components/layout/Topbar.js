"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import MarketMode from "@/components/MarketMode";
import ConnectionStatus from "@/components/ConnectionStatus";

export default function Topbar({ title, mode, onModeChange, connectionStatus, lastUpdate, onSearchSymbol, showSearch = true }) {
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    const symbol = searchValue.trim().toUpperCase();
    if (!symbol) return;
    if (onSearchSymbol) {
      onSearchSymbol(symbol);
    } else {
      router.push(`/scanner`);
    }
    setSearchValue("");
  };

  return (
    <header className="app-topbar">
      <div className="app-topbar-left">
        <span className="app-logo-text">{title || "CRYPTOAI"}</span>
        {mode ? <MarketMode mode={mode} onChange={onModeChange} /> : null}
      </div>
      <div className="app-topbar-right">
        {showSearch ? (
          <form className="app-search" onSubmit={handleSubmit}>
            <Search size={16} />
            <input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Cari symbol... BTCUSDT" />
          </form>
        ) : null}
        {connectionStatus ? <ConnectionStatus status={connectionStatus} lastUpdate={lastUpdate} /> : null}
      </div>
    </header>
  );
}

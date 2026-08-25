"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export default function SymbolSearchBar({ onSearch }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const symbol = value.trim().toUpperCase();
    if (!symbol) return;
    onSearch(symbol);
    setValue("");
  };

  return (
    <form className="app-search app-search-standalone" onSubmit={handleSubmit}>
      <Search size={16} />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Cari symbol... contoh: BTCUSDT" />
    </form>
  );
}

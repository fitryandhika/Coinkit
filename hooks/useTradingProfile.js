"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cryptoai:tradingProfile";

const DEFAULT_PROFILE = {
  market: "spot",
  riskProfile: "MODERATE",
  capital: 100,
  riskPercent: 1,
  maxOpenPositions: 3,
  maxPortfolioRisk: 5,
  openPositions: [],
};

export function useTradingProfile() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
    } catch (err) {
      // localStorage tidak tersedia / data korup — pakai default
    } finally {
      setLoaded(true);
    }
  }, []);

  const updateProfile = useCallback((patch) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        // abaikan kalau storage penuh/diblokir
      }
      return next;
    });
  }, []);

  return { profile, updateProfile, loaded };
}

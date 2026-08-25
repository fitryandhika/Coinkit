"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useTradingProfile } from "@/hooks/useTradingProfile";
import { usePredictions } from "@/hooks/usePredictions";
import TradingProfileForm from "@/components/risk/TradingProfileForm";
import AITradingAssistantPanel from "@/components/ai/AITradingAssistantPanel";
import TradeHistoryList from "@/components/ai/TradeHistoryList";

export default function AIAssistantPage() {
  return (
    <Suspense fallback={null}>
      <AIAssistantContent />
    </Suspense>
  );
}

function AIAssistantContent() {
  const { profile, updateProfile, loaded } = useTradingProfile();
  const { records, loaded: predictionsLoaded, addPrediction, markAction, saveManualTrade } = usePredictions({ limit: 20 });
  const searchParams = useSearchParams();

  const initialSymbol = searchParams.get("symbol") || undefined;
  const initialMarket = searchParams.get("market") || undefined;

  useEffect(() => {
    if (loaded && initialMarket && initialMarket !== profile.market) updateProfile({ market: initialMarket });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initialMarket]);

  if (!loaded || !predictionsLoaded) return null;

  return (
    <>
      <Topbar title="AI Trading Assistant" showSearch={false} />

      <TradingProfileForm profile={profile} onChange={updateProfile} />
      <AITradingAssistantPanel profile={profile} initialSymbol={initialSymbol} addPrediction={addPrediction} markAction={markAction} onJournalSaved={saveManualTrade} />

      <h2 className="section-title">Recent Predictions</h2>
      <TradeHistoryList records={records.map((r) => ({ predictionId: r.id, symbol: r.symbol, decision: r.decision, timestamp: new Date(r.timestamp).getTime(), aiScore: r.score, confidence: r.confidence, status: r.user_action, journal: null }))} />

      <p className="detail-sub" style={{ marginTop: 16 }}>
        CryptoAI adalah asisten analisis, bukan sistem eksekusi. Semua keputusan dan eksekusi trade tetap di tangan Anda.
      </p>
    </>
  );
}

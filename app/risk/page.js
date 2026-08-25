"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useTradingProfile } from "@/hooks/useTradingProfile";
import TradingProfileForm from "@/components/risk/TradingProfileForm";
import TradePlanPanel from "@/components/risk/TradePlanPanel";

export default function RiskPlannerPage() {
  return (
    <Suspense fallback={null}>
      <RiskPlannerContent />
    </Suspense>
  );
}

function RiskPlannerContent() {
  const { profile, updateProfile, loaded } = useTradingProfile();
  const searchParams = useSearchParams();

  const initialSymbol = searchParams.get("symbol") || undefined;
  const initialMarket = searchParams.get("market") || undefined;
  const initialEntryPrice = searchParams.get("entryPrice") || undefined;

  useEffect(() => {
    if (loaded && initialMarket && initialMarket !== profile.market) {
      updateProfile({ market: initialMarket });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initialMarket]);

  if (!loaded) return null;

  return (
    <>
      <Topbar title="Risk Planner" showSearch={false} />

      <TradingProfileForm profile={profile} onChange={updateProfile} />
      <TradePlanPanel profile={profile} initialSymbol={initialSymbol} initialEntryPrice={initialEntryPrice} />

      <p className="detail-sub" style={{ marginTop: 16 }}>
        Trade plan ini murni simulasi/perhitungan — tidak ada order yang dikirim ke Bitget.
      </p>
    </>
  );
}

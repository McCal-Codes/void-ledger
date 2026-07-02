"use client";

import { useState, useEffect, useMemo } from "react";
import { CountdownCard } from "@/components/dashboard/CountdownCard";
import { ResourceGapCard } from "@/components/dashboard/ResourceGapCard";
import { FarmingEstimateCard } from "@/components/dashboard/FarmingEstimateCard";
import { BestFissureCard } from "@/components/dashboard/BestFissureCard";
import { DataHealthCard } from "@/components/dashboard/DataHealthCard";
import { BaroShoppingRunPanel } from "@/components/dashboard/BaroShoppingRunPanel";
import { SourceActionControls, type SourceActionId } from "@/components/data/SourceActionControls";
import { AppShell } from "@/components/layout/AppShell";
import { PortableSetupPanel } from "@/components/onboarding/PortableSetupPanel";
import { useStore } from "@/lib/store/useStore";
import { calculateDucatPlan } from "@/lib/math/ducatMath";
import { calculateTimeEstimate } from "@/lib/math/timeEstimator";
import { loadRealData } from "@/lib/data/dataService";
import { fetchJson } from "@/lib/http/json";
import { buildBalancedDucatPlan } from "@/lib/inventory/ducatOptimizer";
import { buildPrimePartsFromAccount } from "@/lib/inventory/primeParts";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { PrimePartAnalysis } from "@/types/primePartAnalysis";

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [primePartAnalysis, setPrimePartAnalysis] = useState<PrimePartAnalysis | null>(null);
  const [primePartAnalysisError, setPrimePartAnalysisError] = useState<string | null>(null);
  const [healthRefreshKey, setHealthRefreshKey] = useState(0);
  const [primePartsRefreshKey, setPrimePartsRefreshKey] = useState(0);
  const { settings, wishlist, fissures, isLoading, error, lastDataFetch } = useStore();

  useEffect(() => {
    loadRealData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPrimePartAnalysis() {
      try {
        const body = await fetchJson<PrimePartAnalysis>("/api/prime-parts?market=1", undefined, {
          errorMessage: "Prime part analysis failed.",
          emptyMessage: "Prime part analysis response was empty.",
          invalidMessage: "Prime part analysis response was not valid JSON.",
        });
        if (!cancelled) {
          setPrimePartAnalysis(body);
          setPrimePartAnalysisError(null);
        }
      } catch (accountError) {
        console.warn("Failed to load prime part analysis for dashboard planning.", accountError);
        if (!cancelled) {
          setPrimePartAnalysisError("Failed to load prime part analysis. Dashboard planning may be incomplete.");
        }
      }
    }

    void loadPrimePartAnalysis();

    return () => {
      cancelled = true;
    };
  }, [primePartsRefreshKey]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const accountPrimeParts = useMemo(() => {
    const accountItems =
      primePartAnalysis?.accountStatus.hasSnapshot && !primePartAnalysis.accountStatus.isSimulated
        ? primePartAnalysis.accountStatus.items ?? []
        : [];
    return buildPrimePartsFromAccount(accountItems, {
      componentMetadata: primePartAnalysis?.componentMetadata,
      setProtections: primePartAnalysis?.setProtections,
      marketPrices: primePartAnalysis?.marketPrices,
      marketErrors: primePartAnalysis?.marketErrors,
      sellThreshold: settings.sellThreshold,
      burnThreshold: settings.burnThreshold,
    });
  }, [primePartAnalysis, settings.burnThreshold, settings.sellThreshold]);
  const balancedPlan = useMemo(
    () => buildBalancedDucatPlan(accountPrimeParts, wishlist, settings.currentDucats),
    [accountPrimeParts, settings.currentDucats, wishlist]
  );
  const plannedPrimePartDucats = balancedPlan.plannedDucats;

  const { totalWantedDucats, totalWantedCredits, remainingDucats } =
    calculateDucatPlan(
      wishlist,
      settings.currentDucats,
      settings.currentCredits,
      plannedPrimePartDucats
    );
  const ducatGapForPlanning = Math.max(0, remainingDucats);

  const daysRemaining = Math.max(
    0,
    (settings.relayCloseDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isRelayEnded = settings.relayCloseDate.getTime() < currentTime.getTime();
  const shouldShowPortableSetup =
    Boolean(primePartAnalysis) &&
    !primePartAnalysis?.accountStatus.hasSnapshot &&
    wishlist.length === 0;

  const { hoursNeeded, dailyDucatTarget } = calculateTimeEstimate(
    ducatGapForPlanning,
    daysRemaining,
    settings.averageMinutesPerRun,
    settings.expectedDucatsPerRun
  );

  function handleSourceCompleted(action: SourceActionId) {
    if (action === "import-inventory" || action === "refresh-prices") {
      setPrimePartsRefreshKey((value) => value + 1);
    }
    setHealthRefreshKey((value) => value + 1);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-white mb-4">Data Loading Error</h2>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => loadRealData()}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell activeHref="/" mainAriaBusy={isLoading}>
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
            <p className="text-zinc-400">TennoCon Baro Ki&apos;Teer Preparation</p>
            {isRelayEnded && (
              <p className="text-red-400 text-sm mt-1">⚠️ Relay has ended</p>
            )}
            {primePartAnalysisError && (
              <p className="text-yellow-400 text-sm mt-1">{primePartAnalysisError}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {isLoading && (
              <div className="inline-flex items-center gap-2 text-xs text-cyan-300" role="status">
                <LoadingSpinner size={14} />
                Refreshing world data
              </div>
            )}
            {lastDataFetch && (
              <div className="text-xs text-zinc-500">
                Last updated: {lastDataFetch.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {shouldShowPortableSetup && (
          <div className="mb-8">
            <PortableSetupPanel />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CountdownCard
            relayOpenDate={settings.relayOpenDate}
            relayCloseDate={settings.relayCloseDate}
          />
          <ResourceGapCard
            currentDucats={settings.currentDucats}
            currentCredits={settings.currentCredits}
            totalWantedDucats={totalWantedDucats}
            totalWantedCredits={totalWantedCredits}
            plannedConversions={plannedPrimePartDucats}
            availableConversions={balancedPlan.availableDucatCapacity}
          />
          <FarmingEstimateCard
            ducatGap={ducatGapForPlanning}
            daysRemaining={daysRemaining}
            averageMinutesPerRun={settings.averageMinutesPerRun}
            expectedDucatsPerRun={settings.expectedDucatsPerRun}
          />
          <BestFissureCard fissures={fissures} />
          <DataHealthCard refreshKey={healthRefreshKey} />
        </div>

        <BaroShoppingRunPanel
          wishlist={wishlist}
          currentDucats={settings.currentDucats}
          currentCredits={settings.currentCredits}
          plan={balancedPlan}
          primeParts={accountPrimeParts}
          accountStatus={primePartAnalysis?.accountStatus}
          marketStatus={primePartAnalysis?.marketStatus}
        />

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6" aria-label="Data source actions">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-white">Update Data Sources</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Refresh real sources only when requested. Inventory imports remain local and do not modify AlecaFrame.
            </p>
          </div>
          <SourceActionControls onCompleted={handleSourceCompleted} />
        </section>

        <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Summary</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <p className="text-zinc-500 text-sm">Ducat Gap</p>
              <p className="text-2xl font-bold text-yellow-400">
                {ducatGapForPlanning.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Hours Needed</p>
              <p className="text-2xl font-bold text-blue-400">
                {hoursNeeded.toFixed(1)}h
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Daily Target</p>
              <p className="text-2xl font-bold text-green-400">
                {Math.ceil(dailyDucatTarget).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Active Plan</p>
              <p className="text-2xl font-bold text-yellow-400">
                {plannedPrimePartDucats.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Available Ducats</p>
              <p className="text-2xl font-bold text-zinc-200">
                {balancedPlan.availableDucatCapacity.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Days Left</p>
              <p className="text-2xl font-bold text-purple-400">
                {Math.ceil(daysRemaining)}
              </p>
            </div>
          </div>
        </div>
    </AppShell>
  );
}

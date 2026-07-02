"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountInventoryPanel } from "@/components/inventory/AccountInventoryPanel";
import { DucatOptimizerPanel } from "@/components/inventory/DucatOptimizerPanel";
import { MarketPricingPanel } from "@/components/inventory/MarketPricingPanel";
import { PrimePartTable } from "@/components/inventory/PrimePartTable";
import { AppShell } from "@/components/layout/AppShell";
import { useStore } from "@/lib/store/useStore";
import { loadRealData } from "@/lib/data/dataService";
import { fetchJson } from "@/lib/http/json";
import { buildBalancedDucatPlan } from "@/lib/inventory/ducatOptimizer";
import { buildPrimePartsFromAccount, summarizePrimeParts } from "@/lib/inventory/primeParts";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { PrimePartAnalysis } from "@/types/primePartAnalysis";

type MarketRefreshMode = "retry-issues" | "refresh-stale" | "refresh-all";

export default function InventoryClientPage({
  initialAnalysis,
}: {
  initialAnalysis: PrimePartAnalysis;
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [isRefreshingAccount, setIsRefreshingAccount] = useState(false);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const { settings, wishlist, primeParts: storedPrimeParts, updatePrimeParts, isLoading, error } = useStore();

  useEffect(() => {
    loadRealData();
  }, []);

  const refreshAnalysis = useCallback(async () => {
    setIsRefreshingAccount(true);
    setAccountError(null);

    try {
      setAnalysis(
        await fetchJson<PrimePartAnalysis>("/api/prime-parts?market=1", undefined, {
          errorMessage: "Prime part analysis failed.",
          emptyMessage: "Prime part analysis response was empty.",
          invalidMessage: "Prime part analysis response was not valid JSON.",
        })
      );
    } catch (refreshError) {
      setAccountError(
        refreshError instanceof Error ? refreshError.message : "Unable to refresh prime part analysis"
      );
    } finally {
      setIsRefreshingAccount(false);
    }
  }, []);

  const refreshMarket = useCallback(async (mode: MarketRefreshMode) => {
    setIsRefreshingMarket(true);
    setAccountError(null);

    try {
      setAnalysis(
        await fetchJson<PrimePartAnalysis>(
          "/api/prime-parts/market-refresh",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
          },
          {
            errorMessage: "Market refresh failed.",
            emptyMessage: "Market refresh response was empty.",
            invalidMessage: "Market refresh response was not valid JSON.",
          }
        )
      );
    } catch (refreshError) {
      setAccountError(refreshError instanceof Error ? refreshError.message : "Unable to refresh market prices");
    } finally {
      setIsRefreshingMarket(false);
    }
  }, []);

  const keepIds = useMemo(
    () => new Set(storedPrimeParts.filter((part) => part.keep).map((part) => part.id)),
    [storedPrimeParts]
  );
  const primeParts = useMemo(() => {
    const accountItems =
      analysis.accountStatus.hasSnapshot && !analysis.accountStatus.isSimulated
        ? analysis.accountStatus.items ?? []
        : [];
    return buildPrimePartsFromAccount(accountItems, {
      keepIds,
      componentMetadata: analysis.componentMetadata,
      setProtections: analysis.setProtections,
      marketPrices: analysis.marketPrices,
      marketErrors: analysis.marketErrors,
      sellThreshold: settings.sellThreshold,
      burnThreshold: settings.burnThreshold,
    });
  }, [analysis, keepIds, settings.burnThreshold, settings.sellThreshold]);
  const summary = useMemo(() => summarizePrimeParts(primeParts), [primeParts]);
  const balancedPlan = useMemo(
    () => buildBalancedDucatPlan(primeParts, wishlist, settings.currentDucats),
    [primeParts, settings.currentDucats, wishlist]
  );
  const tradeForDucats = primeParts.filter((p) => p.recommendation === "Trade for Ducats").length;

  const togglePrimePartKeep = useCallback(
    (id: string) => {
      const nextParts = primeParts.map((part) => (part.id === id ? { ...part, keep: !part.keep } : part));
      updatePrimeParts(nextParts);
    },
    [primeParts, updatePrimeParts]
  );

  const markOptimizerPlanKeep = useCallback(
    (ids: string[]) => {
      const keepIdsToAdd = new Set(ids);
      if (keepIdsToAdd.size === 0) return;
      const nextParts = primeParts.map((part) =>
        keepIdsToAdd.has(part.id) ? { ...part, keep: true } : part
      );
      updatePrimeParts(nextParts);
    },
    [primeParts, updatePrimeParts]
  );

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
    <AppShell activeHref="/inventory" mainAriaBusy={isLoading}>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Prime Part Inventory</h2>
            <p className="text-zinc-400">Real account prime parts and ducat conversion planning</p>
            {isLoading && (
              <p className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-300" role="status">
                <LoadingSpinner size={14} />
                Refreshing world data
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void refreshAnalysis()}
              disabled={isRefreshingAccount}
              className="inline-flex items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshingAccount ? "Refreshing..." : "Refresh Analysis"}
            </button>
            <button
              type="button"
              onClick={() => void refreshMarket("retry-issues")}
              disabled={isRefreshingMarket || (analysis.marketStatus.retryableIssues ?? 0) === 0}
              className="inline-flex items-center justify-center rounded border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {isRefreshingMarket ? "Refreshing..." : "Retry Market Issues"}
            </button>
          </div>
        </div>

        <AccountInventoryPanel initialStatus={analysis.accountStatus} />

        {accountError && (
          <p className="mb-6 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {accountError}
          </p>
        )}

        <MarketPricingPanel
          status={analysis.marketStatus}
          isRefreshing={isRefreshingMarket}
          onRefresh={(mode) => void refreshMarket(mode)}
        />

        <DucatOptimizerPanel
          parts={primeParts}
          currentDucats={settings.currentDucats}
          plan={balancedPlan}
          onMarkPlanKeep={markOptimizerPlanKeep}
        />

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-white">Prime Part Summary</h3>
            <p className="text-xs text-zinc-500">
              Ducats use AlecaFrame metadata; plat uses Warframe Market v2 top orders.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-9">
            <div>
              <p className="text-zinc-500 text-sm">Unique Parts</p>
              <p className="text-2xl font-bold text-white">{summary.uniqueParts}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Copies</p>
              <p className="text-2xl font-bold text-blue-400">{summary.totalCopies}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Protected</p>
              <p className="text-2xl font-bold text-cyan-300">{summary.protectedCopies}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Trade for Ducats</p>
              <p className="text-2xl font-bold text-yellow-400">{tradeForDucats}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Sell for Plat</p>
              <p className="text-2xl font-bold text-green-400">{summary.sellForPlatinum}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Market Priced</p>
              <p className="text-2xl font-bold text-green-400">{summary.marketPricedParts}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Active Plan</p>
              <p className="text-2xl font-bold text-yellow-400">
                {balancedPlan.plannedDucats.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Available Ducats</p>
              <p className="text-2xl font-bold text-zinc-200">
                {balancedPlan.availableDucatCapacity.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Plat Value</p>
              <p className="text-2xl font-bold text-green-400">
                {Math.round(summary.sellForPlatinumValue).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span>Market: {analysis.marketStatus.fetched} fetched</span>
            <span>{analysis.marketStatus.fromCache} cached</span>
            <span>{analysis.marketStatus.failed} failed</span>
            {analysis.marketStatus.refreshedAt && (
              <span>Checked {new Date(analysis.marketStatus.refreshedAt).toLocaleTimeString()}</span>
            )}
          </div>
          {summary.unknownValues > 0 && (
            <p className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {summary.unknownValues} prime parts need manual ducat verification because the local
              metadata cache did not include a value.
            </p>
          )}
          {summary.protectedCopies > 0 && (
            <p className="mt-4 rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
              {summary.protectedCopies} copies are protected because they contribute to Prime sets
              you do not appear to own yet.
            </p>
          )}
        </div>

        <PrimePartTable parts={primeParts} onToggleKeep={togglePrimePartKeep} />
    </AppShell>
  );
}

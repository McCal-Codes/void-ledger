"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, Clock3, Filter, RefreshCw, Search, ShieldAlert, Zap } from "lucide-react";
import { FissureList } from "@/components/fissures/FissureList";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { loadRealData } from "@/lib/data/dataService";
import { useStore } from "@/lib/store/useStore";
import type { Fissure } from "@/types/fissure";

type SpeedFilter = "all" | "rush" | "fast" | "long";

const TIER_ORDER = ["Lith", "Meso", "Neo", "Axi", "Requiem", "Omnia"];

function scoreGroup(fissure: Fissure): SpeedFilter {
  if (fissure.speedScore >= 0.9) return "rush";
  if (fissure.speedScore >= 0.75) return "fast";
  return "long";
}

function formatTime(minutes: number) {
  if (minutes <= 0) return "Expired";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.floor(minutes % 60);
  return `${hours}h ${remaining}m`;
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">{label}</p>
        <span className={tone}>{icon}</span>
      </div>
      <p className={`mt-3 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function TierButton({
  tier,
  count,
  active,
  onClick,
}: {
  tier: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-2 text-sm transition ${
        active
          ? "border-cyan-400 bg-cyan-500/10 text-cyan-100"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
      }`}
    >
      <span className="font-medium">{tier}</span>
      <span className="ml-2 text-xs text-zinc-500">{count}</span>
    </button>
  );
}

export default function FissuresPage() {
  const { fissures, isLoading, error, lastDataFetch } = useStore();
  const [tierFilter, setTierFilter] = useState("All");
  const [speedFilter, setSpeedFilter] = useState<SpeedFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadRealData();
  }, []);

  const activeFissures = useMemo(
    () => fissures.filter((fissure) => fissure.minutesRemaining > 0),
    [fissures]
  );

  const sortedFissures = useMemo(
    () =>
      [...activeFissures].sort((left, right) => {
        if (right.speedScore !== left.speedScore) return right.speedScore - left.speedScore;
        return left.minutesRemaining - right.minutesRemaining;
      }),
    [activeFissures]
  );

  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>([["All", activeFissures.length]]);
    for (const fissure of activeFissures) counts.set(fissure.tier, (counts.get(fissure.tier) ?? 0) + 1);
    return counts;
  }, [activeFissures]);

  const visibleFissures = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortedFissures.filter((fissure) => {
      const tierMatches = tierFilter === "All" || fissure.tier === tierFilter;
      const speedMatches = speedFilter === "all" || scoreGroup(fissure) === speedFilter;
      const queryMatches =
        normalizedQuery.length === 0 ||
        `${fissure.missionType} ${fissure.node} ${fissure.tier} ${fissure.faction}`
          .toLowerCase()
          .includes(normalizedQuery);
      return tierMatches && speedMatches && queryMatches;
    });
  }, [query, sortedFissures, speedFilter, tierFilter]);

  const bestFissure = sortedFissures[0];
  const rushCount = activeFissures.filter((fissure) => fissure.speedScore >= 0.9).length;
  const fastCount = activeFissures.filter((fissure) => fissure.speedScore >= 0.75).length;
  const steelPathCount = activeFissures.filter((fissure) => fissure.isHard).length;
  const soonestExpiry = sortedFissures.reduce<number | null>(
    (soonest, fissure) =>
      soonest === null ? fissure.minutesRemaining : Math.min(soonest, fissure.minutesRemaining),
    null
  );

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-zinc-100">
        <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h2 className="mb-4 text-xl font-bold text-white">Data Loading Error</h2>
          <p className="mb-6 text-zinc-400">{error}</p>
          <button
            onClick={() => void loadRealData({ force: true })}
            className="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-white transition-colors hover:bg-zinc-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell activeHref="/fissures" mainAriaBusy={isLoading}>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold text-white">Active Fissures</h2>
            <p className="text-zinc-400">Live relic-opening routes ranked for fast ducat runs</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isLoading && (
              <p className="inline-flex items-center gap-2 text-xs text-cyan-300" role="status">
                <LoadingSpinner size={14} />
                Refreshing world data
              </p>
            )}
            {lastDataFetch && (
              <p className="text-xs text-zinc-500">Updated {lastDataFetch.toLocaleTimeString()}</p>
            )}
            <button
              type="button"
              onClick={() => void loadRealData({ force: true })}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {bestFissure && (
          <section className="mb-6 rounded-lg border border-cyan-500/20 bg-zinc-900 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-cyan-300">Priority Run</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-bold text-white">
                    {bestFissure.tier} {bestFissure.missionType}
                  </h3>
                  {bestFissure.isHard && (
                    <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300">
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      Steel Path
                    </span>
                  )}
                </div>
                <p className="mt-1 text-zinc-400">{bestFissure.node}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-zinc-500">Score</p>
                  <p className="mt-1 font-mono text-xl font-bold text-green-300">
                    {(bestFissure.speedScore * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Expires</p>
                  <p className="mt-1 font-mono text-xl font-bold text-zinc-100">
                    {formatTime(bestFissure.minutesRemaining)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Faction</p>
                  <p className="mt-1 text-xl font-bold text-zinc-100">{bestFissure.faction}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Total" value={activeFissures.length} tone="text-white" icon={<Activity className="h-5 w-5" />} />
          <StatTile label="Rush Runs" value={rushCount} tone="text-green-300" icon={<Zap className="h-5 w-5" />} />
          <StatTile label="Fast+" value={fastCount} tone="text-yellow-300" icon={<Filter className="h-5 w-5" />} />
          <StatTile
            label="Soonest Expiry"
            value={soonestExpiry === null ? "-" : formatTime(soonestExpiry)}
            tone="text-cyan-300"
            icon={<Clock3 className="h-5 w-5" />}
          />
        </div>

        <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(240px,1fr)_auto] xl:items-center">
            <label className="relative block">
              <span className="sr-only">Search fissures</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search mission, node, tier"
                className="w-full rounded border border-zinc-700 bg-black px-9 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {(["all", "rush", "fast", "long"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSpeedFilter(filter)}
                  className={`rounded border px-3 py-2 text-sm capitalize transition ${
                    speedFilter === filter
                      ? "border-cyan-400 bg-cyan-500/10 text-cyan-100"
                      : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                  }`}
                >
                  {filter === "all" ? "All Speeds" : filter}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <TierButton
              tier="All"
              count={tierCounts.get("All") ?? 0}
              active={tierFilter === "All"}
              onClick={() => setTierFilter("All")}
            />
            {TIER_ORDER.filter((tier) => tierCounts.has(tier)).map((tier) => (
              <TierButton
                key={tier}
                tier={tier}
                count={tierCounts.get(tier) ?? 0}
                active={tierFilter === tier}
                onClick={() => setTierFilter(tier)}
              />
            ))}
          </div>
          {steelPathCount > 0 && (
            <p className="mt-4 text-xs text-zinc-500">
              {steelPathCount} current fissures are marked Steel Path.
            </p>
          )}
        </section>

        <FissureList fissures={visibleFissures} />
    </AppShell>
  );
}

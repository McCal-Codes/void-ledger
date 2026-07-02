"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, Radio, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchJson } from "@/lib/http/json";
import type { WorldStateResponse } from "@/lib/api/warframeWorldState";

type WorldRecord = Record<string, unknown>;

function asRecord(value: unknown): WorldRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as WorldRecord) : {};
}

function asString(value: unknown, fallback = "Unknown") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatPercent(value: unknown) {
  const numericValue = asNumber(value);
  return numericValue === undefined ? "Unknown" : `${Math.round(numericValue)}%`;
}

function describeMission(value: unknown) {
  const record = asRecord(value);
  const node = asString(record.node, asString(record.location, "Unknown node"));
  const missionType = asString(record.missionType, asString(record.type, "Mission"));
  const tier = asString(record.tier, "");
  const enemy = asString(record.enemy, "");
  return [tier, missionType, node, enemy].filter(Boolean).join(" - ");
}

function describeEvent(value: unknown) {
  const record = asRecord(value);
  return asString(
    record.description,
    asString(record.tooltip, asString(record.node, asString(record.id, "World-state item")))
  );
}

function formatTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function CycleTile({ label, value }: { label: string; value: unknown }) {
  const cycle = asRecord(value);
  const state = asString(cycle.state, asString(cycle.phase, "Unknown"));
  const timeLeft = asString(cycle.timeLeft, asString(cycle.shortString, ""));

  return (
    <div className="rounded border border-zinc-800 bg-black/30 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{state}</p>
      {timeLeft && <p className="mt-1 text-sm text-zinc-400">{timeLeft}</p>}
    </div>
  );
}

function FeaturePanel({ title, value }: { title: string; value: unknown }) {
  const record = asRecord(value);
  const boss = asString(record.boss, "");
  const faction = asString(record.faction, "");
  const node = asString(record.node, "");
  const eta = asString(record.eta, asString(record.timeLeft, ""));
  const location = asString(record.location, "");
  const character = asString(record.character, "");
  const inventory = Array.isArray(record.inventory) ? record.inventory.length : undefined;
  const detail = [boss, faction, node, location].filter(Boolean).join(" - ");

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-white">
        {character || detail || asString(record.currentReward, "Waiting")}
      </p>
      {eta && <p className="mt-2 text-sm text-zinc-400">{eta}</p>}
      {inventory !== undefined && (
        <p className="mt-2 text-sm text-cyan-300">{inventory} Baro inventory items listed</p>
      )}
    </div>
  );
}

function ListPanel({
  title,
  items,
  describe,
}: {
  title: string;
  items?: unknown[];
  describe: (item: unknown) => string;
}) {
  const visibleItems = items ?? [];

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {visibleItems.length === 0 ? (
          <p className="rounded border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-500">
            Nothing active in this feed.
          </p>
        ) : (
          visibleItems.map((item, index) => {
            const record = asRecord(item);
            return (
              <div key={`${title}-${index}`} className="rounded border border-zinc-800 bg-black/30 p-4">
                <p className="font-medium text-zinc-100">{describe(item)}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  {record.eta !== undefined && <span>ETA: {asString(record.eta)}</span>}
                  {record.expiry !== undefined && <span>Expires: {formatTime(record.expiry)}</span>}
                  {record.completion !== undefined && <span>Progress: {formatPercent(record.completion)}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function WorldStateClientPage({
  initialWorldState,
}: {
  initialWorldState: WorldStateResponse;
}) {
  const [worldState, setWorldState] = useState<WorldStateResponse | null>(initialWorldState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialWorldState.ok ? null : initialWorldState.error ?? "Unable to load world state"
  );

  async function refreshWorldState() {
    setIsLoading(true);
    setError(null);

    try {
      const body = await fetchJson<WorldStateResponse>("/api/world-state", { cache: "no-store" }, {
        errorMessage: "Unable to load world state.",
        emptyMessage: "World-state response was empty.",
        invalidMessage: "World-state response was not valid JSON.",
      });
      if (!body.ok) throw new Error(body.error ?? "Unable to load world state");
      setWorldState(body);
    } catch (worldError) {
      setError(worldError instanceof Error ? worldError.message : "Unable to load world state");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    if (initialWorldState) return undefined;

    async function loadInitialWorldState() {
      try {
        const body = await fetchJson<WorldStateResponse>("/api/world-state", { cache: "no-store" }, {
          errorMessage: "Unable to load world state.",
          emptyMessage: "World-state response was empty.",
          invalidMessage: "World-state response was not valid JSON.",
        });
        if (!body.ok) throw new Error(body.error ?? "Unable to load world state");
        if (!cancelled) setWorldState(body);
      } catch (worldError) {
        if (!cancelled) {
          setError(worldError instanceof Error ? worldError.message : "Unable to load world state");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInitialWorldState();

    return () => {
      cancelled = true;
    };
  }, [initialWorldState]);

  const cycleEntries = useMemo(() => Object.entries(worldState?.cycles ?? {}), [worldState?.cycles]);

  return (
    <AppShell activeHref="/world-state">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold text-white">Live World State</h2>
            <p className="text-zinc-400">Public Warframe PC events, cycles, fissures, and vendor status.</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshWorldState()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <p className="mb-6 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 text-zinc-500">
              <Radio className="h-4 w-4" />
              <p className="text-sm">Platform</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{worldState?.platform?.toUpperCase() ?? "PC"}</p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 text-zinc-500">
              <Clock className="h-4 w-4" />
              <p className="text-sm">Synced</p>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">{formatTime(worldState?.syncedAt)}</p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 text-zinc-500">
              <Activity className="h-4 w-4" />
              <p className="text-sm">Feeds</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {(worldState?.alerts?.length ?? 0) +
                (worldState?.events?.length ?? 0) +
                (worldState?.invasions?.length ?? 0) +
                (worldState?.fissures?.length ?? 0)}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="text-lg font-semibold text-white">Cycles</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cycleEntries.map(([key, value]) => (
              <CycleTile key={key} label={key} value={value} />
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <FeaturePanel title="Void Trader" value={worldState?.voidTrader} />
          <FeaturePanel title="Sortie" value={worldState?.sortie} />
          <FeaturePanel title="Archon Hunt" value={worldState?.archonHunt} />
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <ListPanel title="Active Fissures" items={worldState?.fissures} describe={describeMission} />
          <ListPanel title="Invasions" items={worldState?.invasions} describe={describeMission} />
          <ListPanel title="Alerts" items={worldState?.alerts} describe={describeEvent} />
          <ListPanel title="Events" items={worldState?.events} describe={describeEvent} />
        </div>
    </AppShell>
  );
}

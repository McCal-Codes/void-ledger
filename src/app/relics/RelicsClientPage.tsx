"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Database, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RelicInventoryTable } from "@/components/relics/RelicInventoryTable";
import { fetchJson } from "@/lib/http/json";
import type { AccountInventoryItem, AccountInventoryStatus } from "@/types/account";
import type { Relic } from "@/types/relic";

const ERAS: Relic["era"][] = ["Lith", "Meso", "Neo", "Axi", "Requiem"];
const REFINEMENTS: Relic["refinement"][] = ["Intact", "Exceptional", "Flawless", "Radiant"];
const ERA_ORDER = new Map(ERAS.map((era, index) => [era, index]));
const REFINEMENT_ORDER = new Map(REFINEMENTS.map((refinement, index) => [refinement, index]));

export default function RelicsClientPage({
  initialAccountStatus,
}: {
  initialAccountStatus: AccountInventoryStatus;
}) {
  const [status, setStatus] = useState(initialAccountStatus);
  const [query, setQuery] = useState("");
  const [era, setEra] = useState<"All" | Relic["era"]>("All");
  const [refinement, setRefinement] = useState<"All" | Relic["refinement"]>("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshRelics() {
    setIsRefreshing(true);
    setError(null);

    try {
      setStatus(
        await fetchJson<AccountInventoryStatus>("/api/overwolf/inventory?limit=5000", undefined, {
          errorMessage: "Account inventory failed.",
          emptyMessage: "Account inventory response was empty.",
          invalidMessage: "Account inventory response was not valid JSON.",
        })
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh relic inventory");
    } finally {
      setIsRefreshing(false);
    }
  }

  const relics = useMemo(() => buildAccountRelics(status.items ?? []), [status.items]);
  const filteredRelics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return relics.filter((relic) => {
      const matchesQuery =
        !normalizedQuery ||
        relic.name.toLowerCase().includes(normalizedQuery) ||
        relic.sourceType?.toLowerCase().includes(normalizedQuery);
      const matchesEra = era === "All" || relic.era === era;
      const matchesRefinement = refinement === "All" || relic.refinement === refinement;
      return matchesQuery && matchesEra && matchesRefinement;
    });
  }, [era, query, refinement, relics]);

  const totalCopies = relics.reduce((sum, relic) => sum + relic.quantity, 0);
  const radiantCopies = relics
    .filter((relic) => relic.refinement === "Radiant")
    .reduce((sum, relic) => sum + relic.quantity, 0);
  const latestAge = formatAge(status.ageSeconds);

  return (
    <AppShell activeHref="/relics">
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-white">Relic Inventory</h2>
          <p className="text-zinc-400">Real relic collection from your latest account inventory snapshot.</p>
        </div>

        <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-300" />
                <h3 className="text-lg font-semibold text-white">Account Relics</h3>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                Showing relics parsed from a local AlecaFrame import or restored account backup.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshRelics()}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          {!status.hasSnapshot ? (
            <div className="mt-5 rounded border border-zinc-800 bg-black/30 px-4 py-3">
              <p className="text-sm text-zinc-400">
                {status.message ??
                  "No account inventory snapshot is available yet. Import AlecaFrame or restore a JSON backup to populate relics."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/settings#account"
                  className="inline-flex min-h-10 items-center justify-center rounded border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  Import AlecaFrame
                </Link>
                <Link
                  href="/settings#backup"
                  className="inline-flex min-h-10 items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
                >
                  Restore JSON
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Metric label="Unique Relics" value={relics.length} />
                <Metric label="Total Copies" value={totalCopies} tone="yellow" />
                <Metric label="Radiant Copies" value={radiantCopies} tone="cyan" />
                <Metric label="Snapshot" value={latestAge} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                <label className="relative block">
                  <span className="sr-only">Search relic inventory</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search relics"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-500"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter relic era</span>
                  <select
                    value={era}
                    onChange={(event) => setEra(event.target.value as "All" | Relic["era"])}
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
                  >
                    <option value="All">All eras</option>
                    {ERAS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter relic refinement</span>
                  <select
                    value={refinement}
                    onChange={(event) =>
                      setRefinement(event.target.value as "All" | Relic["refinement"])
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
                  >
                    <option value="All">All refinements</option>
                    {REFINEMENTS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
        </section>

        <RelicInventoryTable relics={filteredRelics} />
    </AppShell>
  );
}

function buildAccountRelics(items: AccountInventoryItem[]): Relic[] {
  return items
    .filter((item) => item.category === "Relic")
    .map((item): Relic => {
      const { era, refinement } = parseRelicName(item.name);

      return {
        id: item.id,
        owned: true,
        quantity: item.quantity,
        era,
        name: item.name,
        refinement,
        vaulted: false,
        estimatedDucats: 0,
        estimatedPlatinum: 0,
        relicMarketPrice: 0,
        expectedNetValue: 0,
        recommendedAction: "Crack",
        imageName: item.imageName,
        imageUrl: item.imageUrl,
        sourceType: item.itemType,
      };
    })
    .toSorted((a, b) => {
      const eraDiff = (ERA_ORDER.get(a.era) ?? 99) - (ERA_ORDER.get(b.era) ?? 99);
      const nameDiff = a.name.localeCompare(b.name);
      const refinementDiff =
        (REFINEMENT_ORDER.get(a.refinement) ?? 99) - (REFINEMENT_ORDER.get(b.refinement) ?? 99);
      return eraDiff || nameDiff || refinementDiff;
    });
}

function parseRelicName(name: string): Pick<Relic, "era" | "refinement"> {
  const parts = name.split(/\s+/);
  const parsedEra = ERAS.includes(parts[0] as Relic["era"]) ? (parts[0] as Relic["era"]) : "Lith";
  const parsedRefinement = REFINEMENTS.includes(parts.at(-1) as Relic["refinement"])
    ? (parts.at(-1) as Relic["refinement"])
    : "Intact";

  return { era: parsedEra, refinement: parsedRefinement };
}

function formatAge(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "Waiting";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "yellow" | "cyan";
}) {
  const toneClass = {
    default: "text-white",
    yellow: "text-yellow-300",
    cyan: "text-cyan-300",
  }[tone];

  return (
    <div className="rounded border border-zinc-800 bg-black/30 px-4 py-3">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

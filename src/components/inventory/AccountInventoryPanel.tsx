"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Database, RefreshCw, Search } from "lucide-react";
import { ItemAssetIcon } from "@/components/inventory/ItemAssetIcon";
import { fetchJson } from "@/lib/http/json";
import type { AccountInventoryStatus } from "@/types/account";

const CATEGORY_OPTIONS = ["All", "Relic", "Prime Part", "Mod", "Resource", "Weapon", "Warframe", "Cosmetic", "Other"];

function formatAge(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "Waiting";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}

export function AccountInventoryPanel({ initialStatus }: { initialStatus?: AccountInventoryStatus }) {
  const [status, setStatus] = useState<AccountInventoryStatus | null>(initialStatus ?? null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(!initialStatus);
  const [error, setError] = useState<string | null>(null);

  async function refreshInventory() {
    setIsLoading(true);
    setError(null);

    try {
      setStatus(
        await fetchJson<AccountInventoryStatus>("/api/overwolf/inventory?limit=5000", undefined, {
          errorMessage: "Account inventory failed.",
          emptyMessage: "Account inventory response was empty.",
          invalidMessage: "Account inventory response was not valid JSON.",
        })
      );
    } catch (inventoryError) {
      setError(inventoryError instanceof Error ? inventoryError.message : "Unable to load account inventory");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    if (initialStatus) return undefined;

    async function loadInitialInventory() {
      try {
        const body = await fetchJson<AccountInventoryStatus>("/api/overwolf/inventory?limit=5000", undefined, {
          errorMessage: "Account inventory failed.",
          emptyMessage: "Account inventory response was empty.",
          invalidMessage: "Account inventory response was not valid JSON.",
        });
        if (!cancelled) setStatus(body);
      } catch (inventoryError) {
        if (!cancelled) {
          setError(inventoryError instanceof Error ? inventoryError.message : "Unable to load account inventory");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInitialInventory();

    return () => {
      cancelled = true;
    };
  }, [initialStatus]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const items = status?.items ?? [];

    return items.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.itemType.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, query, status?.items]);

  const liveStatus = status?.hasSnapshot && !status.isSimulated ? status : null;

  return (
    <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">Live Account Inventory</h3>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Normalized account snapshot from AlecaFrame, backup restore, or the local bridge.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshInventory()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {status?.isSimulated && (
        <p className="mt-4 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
          This snapshot is simulator dry-run data, so Void Ledger is ignoring it. Clear it in
          Settings, then import AlecaFrame or restore a real JSON backup.
        </p>
      )}

      {!liveStatus ? (
        <div className="mt-5 rounded border border-zinc-800 bg-black/30 p-4">
          <p className="text-sm text-zinc-400">
            {status?.message ??
              "No account inventory snapshot is saved in this local copy yet. Import AlecaFrame, restore a JSON backup, or continue with manual planning."}
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
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
            <div>
              <p className="text-sm text-zinc-500">Updated</p>
              <p className="text-xl font-bold text-white">{formatAge(liveStatus.ageSeconds)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Unique Items</p>
              <p className="text-xl font-bold text-white">{formatNumber(liveStatus.summary?.uniqueItemCount)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Relics</p>
              <p className="text-xl font-bold text-blue-400">{formatNumber(liveStatus.summary?.relicCount)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Prime Parts</p>
              <p className="text-xl font-bold text-yellow-400">{formatNumber(liveStatus.summary?.primePartCount)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Mods</p>
              <p className="text-xl font-bold text-green-400">{formatNumber(liveStatus.summary?.modCount)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Credits</p>
              <p className="text-xl font-bold text-zinc-100">{formatNumber(liveStatus.resources?.credits)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Ducats</p>
              <p className="text-xl font-bold text-yellow-400">{formatNumber(liveStatus.resources?.ducats)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Platinum</p>
              <p className="text-xl font-bold text-cyan-300">{formatNumber(liveStatus.resources?.platinum)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search account inventory</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onInput={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search inventory"
                className="w-full rounded border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-500"
              />
            </label>
            <label>
              <span className="sr-only">Filter account inventory category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500 md:w-44"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Qty</th>
                  <th className="py-2 font-medium">Source Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.slice(0, 100).map((item) => (
                  <tr key={item.id} className="border-b border-zinc-900">
                    <td className="py-3 pr-4 font-medium text-zinc-100">
                      <div className="flex min-w-0 items-center gap-3">
                        <ItemAssetIcon
                          imageUrl={item.imageUrl}
                          name={item.name}
                          category={item.category}
                          size="sm"
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">{item.category}</td>
                    <td className="py-3 pr-4 text-zinc-300">{item.quantity.toLocaleString()}</td>
                    <td className="max-w-[360px] truncate py-3 text-xs text-zinc-500">{item.itemType}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-zinc-500" colSpan={4}>
                      No account items match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

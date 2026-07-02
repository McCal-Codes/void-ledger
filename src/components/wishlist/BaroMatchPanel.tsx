"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, Plus, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { ItemAssetIcon } from "@/components/inventory/ItemAssetIcon";
import { fetchJson } from "@/lib/http/json";
import type { AccountInventoryItem, AccountInventoryStatus } from "@/types/account";
import type { BaroItem, BaroVisitStatus, WishlistItem } from "@/types/baro";

const PRIORITY_ORDER: Record<BaroItem["recommendedPriority"], number> = {
  "Must Have": 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Skip: 4,
};

const PRIORITIES: Array<"All" | BaroItem["recommendedPriority"]> = [
  "All",
  "Must Have",
  "High",
  "Medium",
  "Low",
  "Skip",
];

const CATEGORIES: Array<"All" | BaroItem["category"]> = [
  "All",
  "Primed Mod",
  "Weapon",
  "Cosmetic",
  "Mod",
  "Decoration",
  "Other",
];

type AccountOwnership = {
  quantity: number;
  matches: AccountInventoryItem[];
};

interface BaroMatchPanelProps {
  catalog: BaroItem[];
  liveItems: BaroItem[];
  visitStatus: BaroVisitStatus | null;
  wishlist: WishlistItem[];
  initialAccountStatus: AccountInventoryStatus;
  onAddItem: (item: WishlistItem) => void;
  onUpdateItem: (id: string, updates: Partial<WishlistItem>) => void;
}

export function BaroMatchPanel({
  catalog,
  liveItems,
  visitStatus,
  wishlist,
  initialAccountStatus,
  onAddItem,
  onUpdateItem,
}: BaroMatchPanelProps) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("All");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [status, setStatus] = useState<AccountInventoryStatus>(initialAccountStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshInventory() {
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
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh account inventory");
    } finally {
      setIsRefreshing(false);
    }
  }

  const wishlistByName = useMemo(() => {
    return new Map(wishlist.map((item) => [normalizeName(item.itemName), item]));
  }, [wishlist]);

  const liveNames = useMemo(() => {
    return new Set(liveItems.map((item) => normalizeName(item.name)));
  }, [liveItems]);

  const accountOwnership = useMemo(() => {
    return buildAccountOwnershipMap(status.items ?? []);
  }, [status.items]);

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = normalizeName(query);

    return catalog
      .filter((item) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          normalizeName(item.name).includes(normalizedQuery) ||
          normalizeName(item.category).includes(normalizedQuery) ||
          normalizeName(item.assetType ?? "").includes(normalizedQuery);
        const matchesPriority = priority === "All" || item.recommendedPriority === priority;
        const matchesCategory = category === "All" || item.category === category;
        return matchesQuery && matchesPriority && matchesCategory;
      })
      .toSorted((a, b) => {
        const liveDiff = Number(liveNames.has(normalizeName(b.name))) - Number(liveNames.has(normalizeName(a.name)));
        const ownedDiff = getOwnedCount(b, accountOwnership) - getOwnedCount(a, accountOwnership);
        const priorityDiff =
          PRIORITY_ORDER[a.recommendedPriority] - PRIORITY_ORDER[b.recommendedPriority];
        return liveDiff || ownedDiff || priorityDiff || a.name.localeCompare(b.name);
      })
      .slice(0, 72);
  }, [accountOwnership, catalog, category, liveNames, priority, query]);

  const topMissingCount = useMemo(() => {
    return catalog.filter((item) => {
      const isTopPick =
        item.recommendedPriority === "Must Have" || item.recommendedPriority === "High";
      return isTopPick && !wishlistByName.has(normalizeName(item.name)) && getOwnedCount(item, accountOwnership) === 0;
    }).length;
  }, [accountOwnership, catalog, wishlistByName]);

  const ownedCatalogCount = useMemo(() => {
    return catalog.filter((item) => getOwnedCount(item, accountOwnership) > 0).length;
  }, [accountOwnership, catalog]);

  const missingCatalogCount = useMemo(() => {
    return catalog.filter((item) => getOwnedCount(item, accountOwnership) === 0).length;
  }, [accountOwnership, catalog]);

  const liveMatches = useMemo(() => {
    return liveItems.filter((item) => wishlistByName.has(normalizeName(item.name)));
  }, [liveItems, wishlistByName]);

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">Baro Shop Picker</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Catalog" value={catalog.length} />
            <Metric label="Have" value={ownedCatalogCount} tone="green" />
            <Metric label="Need" value={missingCatalogCount} tone="amber" />
            <Metric label="Top Picks" value={topMissingCount} tone="cyan" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px_auto] xl:w-[760px]">
          <label className="relative block">
            <span className="sr-only">Search Baro shop</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-white outline-none transition focus:border-cyan-500"
              placeholder="Search shop"
            />
          </label>
          <label>
            <span className="sr-only">Filter category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as (typeof PRIORITIES)[number])}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refreshInventory()}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Account
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <BaroVisitBanner
        liveItemCount={liveItems.length}
        liveMatches={liveMatches.map((item) => item.name)}
        visitStatus={visitStatus}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredCatalog.map((item) => {
          const wishlistItem = wishlistByName.get(normalizeName(item.name));
          const isLive = liveNames.has(normalizeName(item.name));
          const ownedCount = getOwnedCount(item, accountOwnership);

          return (
            <article
              key={item.id}
              className="grid min-h-[152px] grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border border-zinc-800 bg-black/30 p-4"
            >
              <ItemAssetIcon imageUrl={item.imageUrl} name={item.name} category={item.category} size="lg" />
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-white">{item.name}</h4>
                    <p className="mt-1 truncate text-xs text-zinc-500">{item.assetType ?? item.category}</p>
                  </div>
                  <OwnershipBadge ownedCount={ownedCount} wishlistItem={wishlistItem} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <PriorityBadge priority={item.recommendedPriority} />
                  {isLive ? <span className="rounded bg-blue-400/10 px-2 py-1 text-xs text-blue-300">This Visit</span> : null}
                  <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{item.category}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <Price label="Ducats" value={item.ducatCost} tone="yellow" />
                  <Price label="Credits" value={item.creditCost} tone="blue" />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-zinc-500">{item.notes || "No note"}</p>
                  <CatalogAction
                    item={item}
                    wishlistItem={wishlistItem}
                    ownedCount={ownedCount}
                    onAddItem={onAddItem}
                    onUpdateItem={onUpdateItem}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CatalogAction({
  item,
  wishlistItem,
  ownedCount,
  onAddItem,
  onUpdateItem,
}: {
  item: BaroItem;
  wishlistItem?: WishlistItem;
  ownedCount: number;
  onAddItem: (item: WishlistItem) => void;
  onUpdateItem: (id: string, updates: Partial<WishlistItem>) => void;
}) {
  if (wishlistItem?.wanted) {
    return (
      <span className="inline-flex shrink-0 items-center justify-end gap-1 text-xs font-medium text-green-400">
        <Check className="h-4 w-4" aria-hidden="true" />
        Added
      </span>
    );
  }

  if (wishlistItem) {
    return (
      <button
        type="button"
        onClick={() =>
          onUpdateItem(wishlistItem.id, {
            wanted: true,
            owned: ownedCount > 0,
            accountOwnedCount: ownedCount,
          })
        }
        className="inline-flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Want
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAddItem(toWishlistItem(item, ownedCount))}
      className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add
    </button>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "green" | "amber" | "cyan" }) {
  const toneClass = {
    default: "text-white",
    green: "text-green-300",
    amber: "text-amber-300",
    cyan: "text-cyan-300",
  }[tone];

  return (
    <div className="rounded border border-zinc-800 bg-black/30 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-xl font-bold ${toneClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function BaroVisitBanner({
  liveItemCount,
  liveMatches,
  visitStatus,
}: {
  liveItemCount: number;
  liveMatches: string[];
  visitStatus: BaroVisitStatus | null;
}) {
  if (!visitStatus) return null;

  const visibleItemCount = visitStatus.inventoryCount || liveItemCount;

  if (visitStatus.isActive && visibleItemCount > 0) {
    return (
      <div className="mt-5 rounded border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
        <p className="text-sm font-medium text-cyan-200">
          Current Baro visit: {visibleItemCount.toLocaleString()} item{visibleItemCount === 1 ? "" : "s"}
          {visitStatus.location ? ` at ${visitStatus.location}` : ""}
        </p>
        {liveMatches.length > 0 ? (
          <p className="mt-1 text-sm text-zinc-300">Wishlist match: {liveMatches.join(", ")}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded border border-zinc-800 bg-black/30 px-4 py-3">
      <p className="text-sm font-medium text-zinc-200">
        Next Baro visit{visitStatus.activation ? `: ${formatVisitDate(visitStatus.activation)}` : ""}
        {visitStatus.location ? ` at ${visitStatus.location}` : ""}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        The full catalog below is still matched against your account inventory; the bi-weekly visit list will surface here once Warframe publishes items for the active visit.
      </p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: BaroItem["recommendedPriority"] }) {
  const className = {
    "Must Have": "text-red-400 bg-red-400/10",
    High: "text-orange-400 bg-orange-400/10",
    Medium: "text-yellow-400 bg-yellow-400/10",
    Low: "text-blue-400 bg-blue-400/10",
    Skip: "text-zinc-400 bg-zinc-400/10",
  }[priority];

  return <span className={`rounded px-2 py-1 text-xs font-medium ${className}`}>{priority}</span>;
}

function OwnershipBadge({
  ownedCount,
  wishlistItem,
}: {
  ownedCount: number;
  wishlistItem?: WishlistItem;
}) {
  if (ownedCount > 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Have x{ownedCount}
      </span>
    );
  }

  if (wishlistItem?.wanted) {
    return <span className="shrink-0 rounded bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-300">Wanted</span>;
  }

  return <span className="shrink-0 rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400">Need</span>;
}

function Price({ label, value, tone }: { label: string; value: number; tone: "yellow" | "blue" }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className={tone === "yellow" ? "font-mono text-yellow-300" : "font-mono text-blue-300"}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function toWishlistItem(item: BaroItem, ownedCount: number): WishlistItem {
  return {
    id: `catalog:${normalizeName(item.name)}:${Date.now()}`,
    wanted: true,
    owned: ownedCount > 0,
    priority: item.recommendedPriority,
    itemName: item.name,
    category: item.category,
    ducatCost: item.ducatCost,
    creditCost: item.creditCost,
    quantity: 1,
    totalDucats: item.ducatCost,
    totalCredits: item.creditCost,
    notes: item.notes,
    source: item.source,
    accountOwnedCount: ownedCount,
    imageName: item.imageName,
    imageUrl: item.imageUrl,
  };
}

function buildAccountOwnershipMap(items: AccountInventoryItem[]) {
  const ownership = new Map<string, AccountOwnership>();

  for (const item of items) {
    const keys = getAccountItemKeys(item);
    for (const key of keys) {
      const existing = ownership.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.matches.push(item);
      } else {
        ownership.set(key, { quantity: item.quantity, matches: [item] });
      }
    }
  }

  return ownership;
}

function getOwnedCount(item: BaroItem, ownership: Map<string, AccountOwnership>) {
  const keys = getBaroItemKeys(item);
  let count = 0;

  for (const key of keys) {
    count = Math.max(count, ownership.get(key)?.quantity ?? 0);
  }

  return count;
}

function getAccountItemKeys(item: AccountInventoryItem) {
  return uniqueKeys([
    normalizeName(item.name),
    ...getPathKeys(item.itemType),
  ]);
}

function getBaroItemKeys(item: BaroItem) {
  return uniqueKeys([
    normalizeName(item.name),
    ...getPathKeys(item.internalName),
    ...(item.id.startsWith("/Lotus/") ? getPathKeys(item.id) : []),
  ]);
}

function uniqueKeys(keys: string[]) {
  return [...new Set(keys.filter((key) => key.length > 0))];
}

function normalizeName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function formatVisitDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPathKeys(value?: string) {
  if (!value) return [];

  const inventoryPath = value.replace(/^\/Lotus\/StoreItems\//i, "/Lotus/");
  const lastSegment = inventoryPath.split("/").filter(Boolean).at(-1) ?? "";

  return [normalizeName(value), normalizeName(inventoryPath), normalizeName(lastSegment)];
}

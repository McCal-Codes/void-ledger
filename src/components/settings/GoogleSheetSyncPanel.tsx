"use client";

import { useMemo, useState } from "react";
import { DownloadCloud, ExternalLink, ListPlus } from "lucide-react";
import { BaroItem, WishlistItem } from "@/types/baro";
import { fetchJson } from "@/lib/http/json";
import { useStore } from "@/lib/store/useStore";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vS6INzXE-VwdaFk6v9DGyXl2AhtyWUFmFifAls2mpyU/edit?usp=sharing";

type BaroCompendiumResponse = {
  source: string;
  tabs: string[];
  fetchedAt: string;
  count: number;
  items: BaroItem[];
};

type SyncStatus = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

export function GoogleSheetSyncPanel() {
  const { baroCatalog, wishlist, updateBaroCatalog, updateWishlist } = useStore();
  const [status, setStatus] = useState<SyncStatus>({
    type: "idle",
    message: "No sync run yet",
  });

  const importableItems = useMemo(
    () =>
      baroCatalog.filter(
        (item) =>
          item.recommendedPriority === "Must Have" || item.recommendedPriority === "High"
      ),
    [baroCatalog]
  );

  const syncCatalog = async () => {
    setStatus({ type: "loading", message: "Syncing Baro compendium..." });

    try {
      const data = await fetchJson<BaroCompendiumResponse>("/api/baro-compendium", undefined, {
        errorMessage: "Google Sheet sync failed.",
        emptyMessage: "Google Sheet sync response was empty.",
        invalidMessage: "Google Sheet sync response was not valid JSON.",
      });
      const items = data.items.map((item) => ({
        ...item,
        lastUpdated: new Date(item.lastUpdated),
      }));

      updateBaroCatalog(items);
      setStatus({
        type: "success",
        message: `Synced ${items.length} recommendation rows from ${data.tabs.join(", ")}.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to sync Google Sheet",
      });
    }
  };

  const addRecommendedToWishlist = () => {
    const existingNames = new Set(wishlist.map((item) => normalizeName(item.itemName)));
    const additions = importableItems
      .filter((item) => !existingNames.has(normalizeName(item.name)))
      .map(toWishlistItem);

    if (additions.length === 0) {
      setStatus({
        type: "success",
        message: "No new Must Have or High recommendations to add.",
      });
      return;
    }

    updateWishlist([...wishlist, ...additions]);
    setStatus({
      type: "success",
      message: `Added ${additions.length} Must Have or High recommendations to your wishlist.`,
    });
  };

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 md:col-span-2">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Google Sheet Sync</h3>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Pull the public Baro Ki&apos;teer recommendation compendium into Void Ledger,
            then merge the strongest recommendations into your wishlist without replacing
            existing entries.
          </p>
        </div>
        <a
          href={SHEET_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Open Sheet
        </a>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={syncCatalog}
          disabled={status.type === "loading"}
          className="inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 text-white px-4 py-2 rounded transition-colors"
        >
          <DownloadCloud className="w-4 h-4" aria-hidden="true" />
          Sync Catalog
        </button>
        <button
          type="button"
          onClick={addRecommendedToWishlist}
          disabled={baroCatalog.length === 0}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 text-white px-4 py-2 rounded transition-colors"
        >
          <ListPlus className="w-4 h-4" aria-hidden="true" />
          Add Top Picks
        </button>
        <div className="rounded border border-zinc-800 bg-black/30 px-4 py-2">
          <p className="text-xs text-zinc-500">Synced Catalog</p>
          <p className="text-lg font-semibold text-white">{baroCatalog.length}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryMetric label="Must Have" value={countByPriority(baroCatalog, "Must Have")} />
        <SummaryMetric label="High" value={countByPriority(baroCatalog, "High")} />
        <SummaryMetric label="In Wishlist" value={wishlist.length} />
        <SummaryMetric label="Top Picks" value={importableItems.length} />
      </div>

      <p
        className={`mt-4 text-sm ${
          status.type === "error"
            ? "text-red-400"
            : status.type === "success"
              ? "text-green-400"
              : "text-zinc-500"
        }`}
        aria-live="polite"
      >
        {status.message}
      </p>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-black/30 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function toWishlistItem(item: BaroItem): WishlistItem {
  return {
    id: `sheet:${normalizeName(item.name)}`,
    wanted: true,
    owned: false,
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
    imageName: item.imageName,
    imageUrl: item.imageUrl,
  };
}

function countByPriority(
  items: BaroItem[],
  priority: BaroItem["recommendedPriority"]
): number {
  return items.filter((item) => item.recommendedPriority === priority).length;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

"use client";

import { DatabaseZap, DownloadCloud, RefreshCw, RotateCw } from "lucide-react";
import { useState } from "react";
import { fetchBaroInventory } from "@/lib/api/tennoTools";
import { fetchFissures } from "@/lib/api/warframePublicExport";
import { fetchJson } from "@/lib/http/json";
import { useStore } from "@/lib/store/useStore";
import type { BaroItem } from "@/types/baro";

export type SourceActionId = "import-inventory" | "refresh-world" | "refresh-prices" | "sync-sheet";

type SourceActionControlsProps = {
  onCompleted?: (action: SourceActionId) => Promise<void> | void;
};

type ActionState = {
  id: SourceActionId | null;
  message: string;
  type: "idle" | "loading" | "success" | "error";
};

export function SourceActionControls({ onCompleted }: SourceActionControlsProps) {
  const { updateBaroCatalog, updateBaroItems, updateFissures, setLastDataFetch } = useStore();
  const [action, setAction] = useState<ActionState>({
    id: null,
    message: "No source action run yet.",
    type: "idle",
  });

  async function runAction(
    id: SourceActionId,
    pendingMessage: string,
    task: () => Promise<string>
  ) {
    setAction({ id, type: "loading", message: pendingMessage });

    try {
      const message = await task();
      await onCompleted?.(id);
      setAction({ id, type: "success", message });
    } catch (error) {
      setAction({
        id,
        type: "error",
        message: error instanceof Error ? error.message : "Source action failed.",
      });
    }
  }

  const isBusy = action.type === "loading";
  const buttonClass =
    "inline-flex min-h-14 items-center justify-center gap-3 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            void runAction("import-inventory", "Importing account inventory...", async () => {
              await fetchJson<unknown>("/api/alecaframe/import", { method: "POST" }, {
                errorMessage: "AlecaFrame import failed.",
                emptyMessage: "AlecaFrame import response was empty.",
                invalidMessage: "AlecaFrame import response was not valid JSON.",
              });
              return "AlecaFrame cache imported into the account snapshot.";
            })
          }
          disabled={isBusy}
          className={`${buttonClass} border-cyan-500/50 bg-cyan-500/10 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/20`}
        >
          <DatabaseZap className="h-5 w-5 shrink-0" aria-hidden="true" />
          Import AlecaFrame
        </button>
        <button
          type="button"
          onClick={() =>
            void runAction("refresh-world", "Refreshing public world data...", async () => {
              const [fissures, baroItems] = await Promise.all([
                fetchFissures({ cache: "no-store" }),
                fetchBaroInventory({ cache: "no-store" }),
              ]);
              updateFissures(fissures);
              updateBaroItems(baroItems);
              setLastDataFetch(new Date());
              return "World state, fissures, and Baro status refreshed.";
            })
          }
          disabled={isBusy}
          className={buttonClass}
        >
          <RotateCw className="h-5 w-5 shrink-0" aria-hidden="true" />
          Refresh World
        </button>
        <button
          type="button"
          onClick={() =>
            void runAction("refresh-prices", "Refreshing market issues...", async () => {
              await fetchJson<unknown>(
                "/api/prime-parts/market-refresh",
                {
                  method: "POST",
                  cache: "no-store",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mode: "retry-issues" }),
                },
                {
                  errorMessage: "Market refresh failed.",
                  emptyMessage: "Market refresh response was empty.",
                  invalidMessage: "Market refresh response was not valid JSON.",
                }
              );
              return "Prime part market prices refreshed.";
            })
          }
          disabled={isBusy}
          className={buttonClass}
        >
          <RefreshCw className="h-5 w-5 shrink-0" aria-hidden="true" />
          Refresh Prices
        </button>
        <button
          type="button"
          onClick={() =>
            void runAction("sync-sheet", "Syncing Google Sheet...", async () => {
              const data = await fetchJson<{ items?: BaroItem[] }>("/api/baro-compendium", { cache: "no-store" }, {
                errorMessage: "Google Sheet sync failed.",
                emptyMessage: "Google Sheet sync response was empty.",
                invalidMessage: "Google Sheet sync response was not valid JSON.",
              });
              const items = (data.items ?? []).map((item) => ({
                ...item,
                lastUpdated: new Date(item.lastUpdated),
              }));
              updateBaroCatalog(items);
              return `Synced ${items.length.toLocaleString()} Baro recommendation rows.`;
            })
          }
          disabled={isBusy}
          className={buttonClass}
        >
          <DownloadCloud className="h-5 w-5 shrink-0" aria-hidden="true" />
          Sync Sheet
        </button>
      </div>
      <p
        className={`mt-4 text-sm ${
          action.type === "error"
            ? "text-red-300"
            : action.type === "success"
              ? "text-green-300"
              : "text-zinc-500"
        }`}
        aria-live="polite"
      >
        {action.message}
      </p>
    </div>
  );
}

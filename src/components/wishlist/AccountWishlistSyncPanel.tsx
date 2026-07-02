"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCheck, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/http/json";
import type { AccountInventoryStatus } from "@/types/account";
import type { WishlistItem } from "@/types/baro";

type Props = {
  wishlist: WishlistItem[];
  onUpdateItem: (id: string, updates: Partial<WishlistItem>) => void;
  initialStatus?: AccountInventoryStatus;
};

function normalizeMatchName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function formatAge(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "Waiting";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

export function AccountWishlistSyncPanel({ wishlist, onUpdateItem, initialStatus }: Props) {
  const [status, setStatus] = useState<AccountInventoryStatus | null>(initialStatus ?? null);
  const [isLoading, setIsLoading] = useState(!initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);

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

  const matchData = useMemo(() => {
    const accountNames = new Set(
      (status?.items ?? []).flatMap((item) => [
        normalizeMatchName(item.name),
        normalizeMatchName(item.itemType.split("/").filter(Boolean).at(-1) ?? item.itemType),
      ])
    );
    const accountCounts = new Map<string, { count: number; imageUrl?: string; imageName?: string }>();

    for (const accountItem of status?.items ?? []) {
      for (const key of [
        normalizeMatchName(accountItem.name),
        normalizeMatchName(accountItem.itemType.split("/").filter(Boolean).at(-1) ?? accountItem.itemType),
      ]) {
        if (!key) continue;
        const existing = accountCounts.get(key);
        accountCounts.set(key, {
          count: (existing?.count ?? 0) + accountItem.quantity,
          imageUrl: existing?.imageUrl ?? accountItem.imageUrl,
          imageName: existing?.imageName ?? accountItem.imageName,
        });
      }
    }

    const matchedItems = wishlist.filter((item) => accountNames.has(normalizeMatchName(item.itemName)));
    const unappliedItems = matchedItems.filter((item) => !item.owned);

    return {
      matchedItems,
      unappliedItems,
      accountCounts,
    };
  }, [status?.items, wishlist]);

  function applyOwnership() {
    for (const item of matchData.unappliedItems) {
      const match = matchData.accountCounts.get(normalizeMatchName(item.itemName));
      onUpdateItem(item.id, {
        owned: true,
        accountOwnedCount: match?.count,
        imageUrl: item.imageUrl ?? match?.imageUrl,
        imageName: item.imageName ?? match?.imageName,
      });
    }

    setAppliedCount(matchData.unappliedItems.length);
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckCheck className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">Account Wishlist Check</h3>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Compares your wishlist against the latest Overwolf inventory snapshot.
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

      {!status?.hasSnapshot ? (
        <p className="mt-4 rounded border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-400">
          {status?.message ?? "No account snapshot is available yet."}
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-zinc-500">Snapshot</p>
              <p className="font-semibold text-zinc-100">{formatAge(status.ageSeconds)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Account Items</p>
              <p className="font-semibold text-zinc-100">{status.summary?.uniqueItemCount ?? 0}</p>
            </div>
            <div>
              <p className="text-zinc-500">Wishlist Owned</p>
              <p className="font-semibold text-green-300">{matchData.matchedItems.length}</p>
            </div>
            <div>
              <p className="text-zinc-500">Can Apply</p>
              <p className="font-semibold text-cyan-300">{matchData.unappliedItems.length}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={matchData.unappliedItems.length === 0}
            onClick={applyOwnership}
            className="rounded border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Apply Account Ownership
          </button>
        </div>
      )}

      {appliedCount > 0 && (
        <p className="mt-4 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-200">
          Marked {appliedCount} wishlist item{appliedCount === 1 ? "" : "s"} as owned.
        </p>
      )}
    </section>
  );
}

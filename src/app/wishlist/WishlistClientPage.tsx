"use client";

import { useEffect, useState } from "react";
import { AccountWishlistSyncPanel } from "@/components/wishlist/AccountWishlistSyncPanel";
import { BaroMatchPanel } from "@/components/wishlist/BaroMatchPanel";
import { WishlistAddForm } from "@/components/wishlist/WishlistAddForm";
import { WishlistTable } from "@/components/wishlist/WishlistTable";
import { WishlistSummary } from "@/components/wishlist/WishlistSummary";
import { AppShell } from "@/components/layout/AppShell";
import { useStore } from "@/lib/store/useStore";
import { loadRealData } from "@/lib/data/dataService";
import { readJsonResponse } from "@/lib/http/json";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { AccountInventoryStatus } from "@/types/account";
import type { BaroVisitStatus } from "@/types/baro";

const BARO_CATALOG_ASSET_VERSION = 2;

export default function WishlistClientPage({
  initialAccountStatus,
}: {
  initialAccountStatus: AccountInventoryStatus;
}) {
  const {
    wishlist,
    addWishlistItem,
    updateWishlistItem,
    removeWishlistItem,
    toggleWishlistItem,
    toggleOwnedItem,
    baroItems,
    baroCatalog,
    updateBaroCatalog,
    isLoading,
    error,
  } = useStore();

  const [baroVisitStatus, setBaroVisitStatus] = useState<BaroVisitStatus | null>(null);
  const needsCatalogRefresh =
    baroCatalog.length === 0 ||
    baroCatalog.some((item) => item.assetVersion !== BARO_CATALOG_ASSET_VERSION);

  useEffect(() => {
    loadRealData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBaroVisitStatus() {
      try {
        const response = await fetch("/api/baro");
        if (!response.ok) return;
        const data = await readJsonResponse<{
          activation?: string;
          expiry?: string;
          location?: string;
          character?: string;
          inventory?: unknown[];
        }>(response, {
          emptyMessage: "Baro status response was empty.",
          invalidMessage: "Baro status response was not valid JSON.",
        });
        if (cancelled) return;

        const activationMs = data.activation ? new Date(data.activation).getTime() : Number.NaN;
        const expiryMs = data.expiry ? new Date(data.expiry).getTime() : Number.NaN;
        const now = Date.now();

        setBaroVisitStatus({
          activation: data.activation,
          expiry: data.expiry,
          location: data.location,
          character: data.character,
          inventoryCount: Array.isArray(data.inventory) ? data.inventory.length : 0,
          isActive: Number.isFinite(activationMs) && Number.isFinite(expiryMs) && now >= activationMs && now <= expiryMs,
          fetchedAt: new Date().toISOString(),
        });
      } catch {
        // Wishlist still works without visit metadata.
      }
    }

    void loadBaroVisitStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!needsCatalogRefresh) return;

      try {
        const response = await fetch("/api/baro-compendium");
        if (!response.ok) return;
        const data = await readJsonResponse<{ items?: typeof baroCatalog }>(response, {
          emptyMessage: "Baro compendium response was empty.",
          invalidMessage: "Baro compendium response was not valid JSON.",
        });
        if (cancelled || !Array.isArray(data.items)) return;
        updateBaroCatalog(
          data.items.map((item) => ({
            ...item,
            lastUpdated: new Date(item.lastUpdated),
            assetVersion: BARO_CATALOG_ASSET_VERSION,
          }))
        );
      } catch {
        // The manual form still works when the catalog cannot be loaded.
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [needsCatalogRefresh, updateBaroCatalog]);

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
    <AppShell activeHref="/wishlist" mainAriaBusy={isLoading}>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Baro Wishlist</h2>
          <p className="text-zinc-400">Select items you want to purchase from Baro Ki&apos;Teer</p>
          {isLoading && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-300" role="status">
              <LoadingSpinner size={14} />
              Refreshing world data
            </p>
          )}
        </div>

        <WishlistSummary items={wishlist} />

        <div className="mt-6">
          <WishlistAddForm onAddItem={addWishlistItem} />
        </div>

        <div className="mt-6">
          <BaroMatchPanel
            catalog={baroCatalog}
            liveItems={baroItems}
            visitStatus={baroVisitStatus}
            wishlist={wishlist}
            initialAccountStatus={initialAccountStatus}
            onAddItem={addWishlistItem}
            onUpdateItem={updateWishlistItem}
          />
        </div>

        <div className="mt-6">
          <AccountWishlistSyncPanel
            wishlist={wishlist}
            onUpdateItem={updateWishlistItem}
            initialStatus={initialAccountStatus}
          />
        </div>

        <div className="mt-6">
          <WishlistTable
            items={wishlist}
            onToggleWanted={toggleWishlistItem}
            onToggleOwned={toggleOwnedItem}
            onUpdateItem={updateWishlistItem}
            onRemoveItem={removeWishlistItem}
          />
        </div>
    </AppShell>
  );
}

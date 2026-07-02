import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WishlistItem } from "@/types/baro";
import { Relic } from "@/types/relic";
import { PrimePart } from "@/types/market";
import { Settings } from "@/types/settings";
import { Fissure } from "@/types/fissure";
import { BaroItem } from "@/types/baro";

const DEFAULT_RELAY_OPEN_DATE = new Date("2026-07-11T11:00:00-04:00");
const DEFAULT_RELAY_CLOSE_DATE = new Date("2026-07-18T11:00:00-04:00");
const MINUTE_MS = 60 * 1000;
const SEEDED_WISHLIST_ITEMS = new Map([
  ["1", "Primed Flow"],
  ["2", "Primed Continuity"],
  ["3", "Primed Pressure Point"],
]);
const SEEDED_RELIC_ITEMS = new Map([
  ["1", "Lith M1"],
  ["2", "Meso P1"],
]);
const SEEDED_PRIME_PART_ITEMS = new Map([
  ["1", "Braton Prime Blueprint"],
  ["2", "Braton Prime Receiver"],
  ["3", "Soma Prime Receiver"],
  ["4", "Fang Prime Blade"],
]);

function toDate(value: unknown, fallback: Date): Date {
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function recalculateWishlistItem(item: WishlistItem): WishlistItem {
  const quantity = Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1;
  const totalDucats = item.wanted && !item.owned ? item.ducatCost * quantity : 0;
  const totalCredits = item.wanted && !item.owned ? item.creditCost * quantity : 0;

  return {
    ...item,
    quantity,
    totalDucats,
    totalCredits,
  };
}

function reviveBaroItems(items: BaroItem[]): BaroItem[] {
  return items.map((item) => ({
    ...item,
    lastUpdated: toDate(item.lastUpdated, new Date()),
  }));
}

function removeSeededWishlistItems(items: WishlistItem[]): WishlistItem[] {
  return items.filter(
    (item) => SEEDED_WISHLIST_ITEMS.get(String(item.id)) !== item.itemName
  );
}

function removeSeededRelics(items: Relic[]): Relic[] {
  return items.filter((item) => SEEDED_RELIC_ITEMS.get(String(item.id)) !== item.name);
}

function removeSeededPrimeParts(items: PrimePart[]): PrimePart[] {
  return items.filter(
    (item) => SEEDED_PRIME_PART_ITEMS.get(String(item.id)) !== item.partName
  );
}

// Custom storage adapter to handle Date serialization
// Note: Using 'any' for storage type because zustand's PersistStorage interface
// expects exact type matching, but our custom storage handles Date serialization
// which doesn't perfectly align with the generic type constraints.
const customStorage = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    if (str === null) {
      return null;
    }
    try {
      const data = JSON.parse(str);
      // Convert date strings back to Date objects
      if (data.state) {
        if (data.state.settings) {
          data.state.settings.accountDataSource =
            data.state.settings.accountDataSource === "alecaframe" ||
            data.state.settings.accountDataSource === "overwolf"
              ? data.state.settings.accountDataSource
              : "manual";
          data.state.settings.relayOpenDate = toDate(
            data.state.settings.relayOpenDate,
            DEFAULT_RELAY_OPEN_DATE
          );
          data.state.settings.relayCloseDate = toDate(
            data.state.settings.relayCloseDate,
            DEFAULT_RELAY_CLOSE_DATE
          );
        }
        if (data.state.lastDataFetch) {
          const date = toDate(data.state.lastDataFetch, new Date());
          data.state.lastDataFetch = Number.isNaN(date.getTime()) ? null : date;
        }
        if (Array.isArray(data.state.wishlist)) {
          data.state.wishlist = removeSeededWishlistItems(data.state.wishlist);
        }
        if (Array.isArray(data.state.relics)) {
          data.state.relics = removeSeededRelics(data.state.relics);
        }
        if (Array.isArray(data.state.primeParts)) {
          data.state.primeParts = removeSeededPrimeParts(data.state.primeParts);
        }
        if (data.state.fissures) {
          data.state.fissures = data.state.fissures.map((f: unknown) => {
            const fissure = f as Partial<Fissure> & { expiry?: Date | string };
            const start = toDate(fissure.start, new Date());
            const end = toDate(fissure.end ?? fissure.expiry, new Date());
            return {
              ...fissure,
              start,
              end,
              minutesRemaining:
                typeof fissure.minutesRemaining === "number"
                  ? fissure.minutesRemaining
                  : Math.max(0, Math.ceil((end.getTime() - Date.now()) / MINUTE_MS)),
            };
          });
        }
        if (!data.state.baroCatalog && Array.isArray(data.state.baroItems)) {
          const syncedCatalog = data.state.baroItems.filter(
            (item: BaroItem) => item.source === "community"
          );
          if (syncedCatalog.length > 0) {
            data.state.baroCatalog = syncedCatalog;
            data.state.baroItems = data.state.baroItems.filter(
              (item: BaroItem) => item.source !== "community"
            );
          }
        }
        if (Array.isArray(data.state.baroItems)) {
          data.state.baroItems = reviveBaroItems(data.state.baroItems);
        }
        if (Array.isArray(data.state.baroCatalog)) {
          data.state.baroCatalog = reviveBaroItems(data.state.baroCatalog);
        }
      }
      return data;
    } catch (error) {
      localStorage.removeItem(name);
      if (!(error instanceof SyntaxError)) {
        console.error("Error reading local storage data: - useStore.ts:154", error);
      }
      return null;
    }
  },
  setItem: (name: string, value: unknown) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

interface StoreState {
  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Wishlist
  wishlist: WishlistItem[];
  updateWishlist: (wishlist: WishlistItem[]) => void;
  addWishlistItem: (item: WishlistItem) => void;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => void;
  removeWishlistItem: (id: string) => void;
  toggleWishlistItem: (id: string) => void;
  toggleOwnedItem: (id: string) => void;

  // Relics
  relics: Relic[];
  updateRelics: (relics: Relic[]) => void;
  toggleRelicOwned: (id: string) => void;

  // Prime Parts
  primeParts: PrimePart[];
  updatePrimeParts: (parts: PrimePart[]) => void;
  togglePrimePartKeep: (id: string) => void;

  // Fissures
  fissures: Fissure[];
  updateFissures: (fissures: Fissure[]) => void;

  // Baro Items
  baroItems: BaroItem[];
  updateBaroItems: (baroItems: BaroItem[]) => void;
  baroCatalog: BaroItem[];
  updateBaroCatalog: (baroCatalog: BaroItem[]) => void;

  // Relic Prices (using plain object for serialization)
  relicPrices: Record<string, number>;
  updateRelicPrices: (relicPrices: Record<string, number>) => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Data freshness
  lastDataFetch: Date | null;
  setLastDataFetch: (date: Date) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      // Initial settings
      settings: {
        platform: "pc",
        accountDataSource: "manual",
        currentDucats: 0,
        currentCredits: 0,
        averageMinutesPerRun: 4,
        expectedDucatsPerRun: 35,
        hoursAvailablePerDay: 2,
        sellThreshold: 0.14,
        burnThreshold: 0.10,
        platToDucatConversion: 10,
        undercutBuffer: 1,
        relayOpenDate: DEFAULT_RELAY_OPEN_DATE,
        relayCloseDate: DEFAULT_RELAY_CLOSE_DATE,
      },

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Wishlist
      wishlist: [],
      updateWishlist: (wishlist) => set({ wishlist: wishlist.map(recalculateWishlistItem) }),
      addWishlistItem: (item) =>
        set((state) => ({
          wishlist: [...state.wishlist, recalculateWishlistItem(item)],
        })),
      updateWishlistItem: (id, updates) =>
        set((state) => ({
          wishlist: state.wishlist.map((item) =>
            item.id === id ? recalculateWishlistItem({ ...item, ...updates }) : item
          ),
        })),
      removeWishlistItem: (id) =>
        set((state) => ({
          wishlist: state.wishlist.filter((item) => item.id !== id),
        })),
      toggleWishlistItem: (id) =>
        set((state) => ({
          wishlist: state.wishlist.map((item) =>
            item.id === id ? recalculateWishlistItem({ ...item, wanted: !item.wanted }) : item
          ),
        })),
      toggleOwnedItem: (id) =>
        set((state) => ({
          wishlist: state.wishlist.map((item) =>
            item.id === id ? recalculateWishlistItem({ ...item, owned: !item.owned }) : item
          ),
        })),

      // Relics
      relics: [],
      updateRelics: (relics) => set({ relics }),
      toggleRelicOwned: (id) =>
        set((state) => ({
          relics: state.relics.map((relic) =>
            relic.id === id ? { ...relic, owned: !relic.owned } : relic
          ),
        })),

      // Prime Parts
      primeParts: [],
      updatePrimeParts: (primeParts) => set({ primeParts }),
      togglePrimePartKeep: (id) =>
        set((state) => ({
          primeParts: state.primeParts.map((part) =>
            part.id === id ? { ...part, keep: !part.keep } : part
          ),
        })),

      // Fissures
      fissures: [],
      updateFissures: (fissures) => set({ fissures }),

      // Baro Items
      baroItems: [],
      updateBaroItems: (baroItems) => set({ baroItems }),
      baroCatalog: [],
      updateBaroCatalog: (baroCatalog) => set({ baroCatalog }),

      // Relic Prices
      relicPrices: {},
      updateRelicPrices: (relicPrices) => set({ relicPrices }),

      // UI State
      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),
      error: null,
      setError: (error) => set({ error }),

      // Data freshness
      lastDataFetch: null,
      setLastDataFetch: (lastDataFetch) => set({ lastDataFetch }),
    }),
    {
      name: "void-ledger-storage",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storage: customStorage as any, // Type assertion needed due to Date serialization handling
      partialize: (state) => ({
        settings: state.settings,
        wishlist: state.wishlist,
        relics: state.relics,
        primeParts: state.primeParts,
        baroCatalog: state.baroCatalog,
      }),
    }
  )
);

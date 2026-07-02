export type AccountInventoryItem = {
  id: string;
  name: string;
  itemType: string;
  category: "Relic" | "Prime Part" | "Mod" | "Resource" | "Weapon" | "Warframe" | "Cosmetic" | "Other";
  quantity: number;
  rawPath?: string;
  imageName?: string;
  imageUrl?: string;
  assetSource?: "alecaframe-cache" | "warframe-cdn" | "wiki" | "fallback";
  assetType?: string;
  ducatValue?: number;
  valuationSource?: "alecaframe-cache" | "inferred" | "unknown";
};

export type AccountInventoryResources = {
  credits?: number;
  platinum?: number;
  freePlatinum?: number;
  ducats?: number;
  endo?: number;
};

export type AccountInventorySummary = {
  itemCount: number;
  rawType: string;
  parsed: boolean;
  relicCount: number;
  primePartCount: number;
  modCount: number;
  resourceCount: number;
  uniqueItemCount: number;
};

export type AccountInventorySnapshot = {
  source: string;
  receivedAt: string;
  gameId?: number;
  feature?: string;
  eventType?: string;
  rawInventory: unknown;
  summary: AccountInventorySummary;
  items: AccountInventoryItem[];
  resources: AccountInventoryResources;
};

export type AccountInventoryStatus = {
  connected: boolean;
  hasSnapshot: boolean;
  isSimulated?: boolean;
  endpoint: string;
  receivedAt?: string;
  ageSeconds?: number | null;
  source?: string;
  gameId?: number;
  feature?: string;
  eventType?: string;
  summary?: AccountInventorySummary;
  resources?: AccountInventoryResources;
  items?: AccountInventoryItem[];
  returnedItemCount?: number;
  file?: {
    path: string;
    sizeBytes: number;
    lastModified: string;
  };
  rawInventory?: unknown;
  message?: string;
};

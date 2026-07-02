export type BaroItem = {
  id: string;
  name: string;
  category: "Primed Mod" | "Weapon" | "Cosmetic" | "Mod" | "Decoration" | "Other";
  ducatCost: number;
  creditCost: number;
  tradable: boolean;
  owned: boolean;
  recommendedPriority: "Must Have" | "High" | "Medium" | "Low" | "Skip";
  notes?: string;
  source: "spreadsheet" | "official" | "community" | "manual";
  lastUpdated: Date;
  internalName?: string;
  imageName?: string;
  imageUrl?: string;
  assetSource?: "alecaframe-cache" | "warframe-cdn" | "wiki" | "fallback";
  assetType?: string;
  assetVersion?: number;
};

export type BaroVisitStatus = {
  activation?: string;
  expiry?: string;
  location?: string;
  character?: string;
  inventoryCount: number;
  isActive: boolean;
  fetchedAt: string;
};

export type WishlistItem = {
  id: string;
  wanted: boolean;
  owned: boolean;
  priority: "Must Have" | "High" | "Medium" | "Low" | "Skip";
  itemName: string;
  category: string;
  ducatCost: number;
  creditCost: number;
  quantity: number;
  totalDucats: number;
  totalCredits: number;
  notes?: string;
  source: string;
  accountOwnedCount?: number;
  imageUrl?: string;
  imageName?: string;
};

export type MarketPrice = {
  itemName: string;
  marketUrlName: string;
  lowestOnlineSell: number;
  medianOnlineSell: number;
  highestBuyOrder: number;
  liquidPlatEstimate: number;
  volume: number;
  source?: "warframe-market-v2" | "cache" | "unavailable";
  error?: string;
  lastUpdated: Date;
};

export type MarketPricingIssue = {
  partName: string;
  slug: string;
  status: "missing" | "stale" | "transient-error" | "unavailable";
  error?: string;
  lastChecked?: string;
  retryable: boolean;
};

export type PrimePartRecommendation =
  | "Sell for Platinum"
  | "Trade for Ducats"
  | "Gray Zone"
  | "Keep"
  | "Protect Set"
  | "Check Manually";

export type PrimePart = {
  id: string;
  owned: boolean;
  quantity: number;
  partName: string;
  ducatValue: number;
  totalDucatValue: number;
  plannedDucatValue: number;
  marketPlatValue: number;
  lowestOnlineSell?: number;
  medianOnlineSell?: number;
  highestBuyOrder?: number;
  platPerDucat: number;
  recommendation: PrimePartRecommendation;
  keep: boolean;
  itemType?: string;
  imageName?: string;
  imageUrl?: string;
  sourceType?: string;
  valuationSource?: "alecaframe-cache" | "inferred" | "unknown";
  marketUrlName?: string;
  marketSource?: "warframe-market-v2" | "cache" | "unavailable";
  marketError?: string;
  protectedQuantity: number;
  convertibleQuantity: number;
  protectedForSetName?: string;
  setOwned?: boolean;
  setCanCraft?: boolean;
  missingSetParts?: string[];
  notes?: string;
  lastPriceUpdate: Date | null;
};

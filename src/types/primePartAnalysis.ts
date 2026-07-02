import type { AccountInventoryStatus } from "@/types/account";
import type { MarketPrice, MarketPricingIssue, PrimePart } from "@/types/market";
import type { PrimeComponentMetadata, PrimeSetProtection } from "@/lib/inventory/primeSetProtection";

export type PrimePartMarketStatus = {
  requested: number;
  priced?: number;
  fromCache: number;
  fetched: number;
  failed: number;
  missing?: number;
  stale?: number;
  unavailable?: number;
  retryableIssues?: number;
  issues?: MarketPricingIssue[];
  cachePath?: string;
  refreshedAt?: string;
  message?: string;
  readOnly?: boolean;
};

export type PrimePartAnalysis = {
  accountStatus: AccountInventoryStatus;
  parts: PrimePart[];
  componentMetadata: Record<string, PrimeComponentMetadata>;
  setProtections: Record<string, PrimeSetProtection>;
  marketPrices: Record<string, MarketPrice>;
  marketErrors: Record<string, string>;
  marketStatus: PrimePartMarketStatus;
};

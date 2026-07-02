import { readPrimePartMarketPrices } from "@/lib/api/warframeMarket";
import { getOverwolfInventoryStatus } from "@/lib/account/overwolfSnapshotStatus";
import { buildPrimePartsFromAccount } from "@/lib/inventory/primeParts";
import { getPrimeComponentMetadata, getPrimeSetProtections } from "@/lib/inventory/primeSetProtection";
import type { MarketPrice } from "@/types/market";
import type { PrimePartAnalysis } from "@/types/primePartAnalysis";

function marketMapToObject(prices: Map<string, MarketPrice>) {
  return Object.fromEntries(prices.entries());
}

function errorMapToObject(errors: Map<string, string>) {
  return Object.fromEntries(errors.entries());
}

export async function getPrimePartAnalysis({
  includeMarket = true,
  refreshMarket = false,
}: {
  includeMarket?: boolean;
  refreshMarket?: boolean;
} = {}): Promise<PrimePartAnalysis> {
  const accountStatus = await getOverwolfInventoryStatus({ limit: 5000 });
  const accountItems =
    accountStatus.hasSnapshot && !accountStatus.isSimulated ? accountStatus.items ?? [] : [];
  const [componentMetadata, setProtections] = await Promise.all([
    getPrimeComponentMetadata(accountItems),
    getPrimeSetProtections(accountItems),
  ]);
  const partsWithoutMarket = buildPrimePartsFromAccount(accountItems, {
    componentMetadata,
    setProtections,
  });

  if (!includeMarket || partsWithoutMarket.length === 0) {
    return {
      accountStatus,
      parts: partsWithoutMarket,
      componentMetadata,
      setProtections,
      marketPrices: {},
      marketErrors: {},
      marketStatus: {
        requested: 0,
        priced: 0,
        fromCache: 0,
        fetched: 0,
        failed: 0,
        missing: 0,
        stale: 0,
        unavailable: 0,
        retryableIssues: 0,
        issues: [],
        message: includeMarket ? undefined : "Market lookup skipped.",
        readOnly: true,
      },
    };
  }

  const market = await readPrimePartMarketPrices(partsWithoutMarket.map((part) => part.partName));
  if (refreshMarket) {
    market.status.message = "GET market analysis is read-only. Use POST /api/prime-parts/market-refresh.";
  }
  const marketPrices = marketMapToObject(market.prices);
  const marketErrors = errorMapToObject(market.errors);
  const parts = buildPrimePartsFromAccount(accountItems, {
    componentMetadata,
    setProtections,
    marketPrices,
    marketErrors,
  });

  return {
    accountStatus,
    parts,
    componentMetadata,
    setProtections,
    marketPrices,
    marketErrors,
    marketStatus: market.status,
  };
}

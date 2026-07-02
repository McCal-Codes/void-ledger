import type { AccountInventoryItem } from "@/types/account";
import type { MarketPrice, PrimePart } from "@/types/market";
import type { PrimeComponentMetadata, PrimeSetProtection } from "@/lib/inventory/primeSetProtection";

const GENERIC_PRIME_PART_NAMES = new Set([
  "barrel",
  "blade",
  "blueprint",
  "chassis",
  "gauntlet",
  "grip",
  "guard",
  "handle",
  "hilt",
  "link",
  "neuroptics",
  "ornament",
  "pouch",
  "receiver",
  "stock",
  "string",
  "systems",
]);

type BuildPrimePartsOptions = {
  keepIds?: ReadonlySet<string>;
  componentMetadata?: Record<string, PrimeComponentMetadata>;
  setProtections?: Record<string, PrimeSetProtection>;
  marketPrices?: Record<string, MarketPrice>;
  marketErrors?: Record<string, string>;
  sellThreshold?: number;
  burnThreshold?: number;
};

function isKeepIdSet(value: ReadonlySet<string> | BuildPrimePartsOptions): value is ReadonlySet<string> {
  return typeof (value as ReadonlySet<string>).has === "function";
}

function prettifySegment(value: string) {
  return value
    .replace(/HelmetBlueprint$/i, "NeuropticsBlueprint")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayPrimePartName(item: AccountInventoryItem, metadata?: PrimeComponentMetadata) {
  if (metadata?.displayName) return metadata.displayName;

  const currentName = item.name.trim();
  const normalizedName = currentName.toLowerCase();

  if (
    currentName &&
    currentName.includes("Prime") &&
    !GENERIC_PRIME_PART_NAMES.has(normalizedName) &&
    !currentName.startsWith("/Lotus/")
  ) {
    return currentName.replace(/\s+Helmet\s+Blueprint$/i, " Neuroptics Blueprint");
  }

  const lastSegment = item.itemType.split("/").filter(Boolean).at(-1) ?? currentName;
  return prettifySegment(lastSegment) || currentName || "Prime Part";
}

function getValuationSource(item: AccountInventoryItem): PrimePart["valuationSource"] {
  if (item.valuationSource) return item.valuationSource;
  return item.ducatValue !== undefined ? "alecaframe-cache" : "unknown";
}

function getMarketPrice(partName: string, marketPrices?: Record<string, MarketPrice>) {
  return marketPrices?.[partName];
}

function isUnavailableMarketError(error?: string) {
  return Boolean(error && (/no warframe market listing/i.test(error) || /\b404\b|not found/i.test(error)));
}

function buildRecommendation({
  keep,
  ducatValue,
  marketPlatValue,
  platPerDucat,
  protectedQuantity,
  quantity,
  sellThreshold,
  burnThreshold,
}: {
  keep: boolean;
  ducatValue: number;
  marketPlatValue: number;
  platPerDucat: number;
  protectedQuantity: number;
  quantity: number;
  sellThreshold: number;
  burnThreshold: number;
}): PrimePart["recommendation"] {
  if (keep) return "Keep";
  if (protectedQuantity >= quantity) return "Protect Set";
  if (ducatValue <= 0) return "Check Manually";
  if (marketPlatValue > 0) {
    if (platPerDucat >= sellThreshold) return "Sell for Platinum";
    if (platPerDucat <= burnThreshold) return "Trade for Ducats";
    return "Gray Zone";
  }
  return "Trade for Ducats";
}

function buildNotes(part: {
  ducatValue: number;
  marketPrice?: MarketPrice;
  marketError?: string;
  protection?: PrimeSetProtection;
  recommendation: PrimePart["recommendation"];
}) {
  if (part.recommendation === "Protect Set" && part.protection) return part.protection.reason;
  if (part.marketPrice?.liquidPlatEstimate && part.marketError) {
    return `Cached market value; ${part.marketError}`;
  }
  if (part.marketPrice?.liquidPlatEstimate) return "Market value from Warframe Market v2 top orders.";
  if (isUnavailableMarketError(part.marketError)) return "No Warframe Market listing found; use ducat value only.";
  if (part.marketError) return part.marketError;
  if (part.ducatValue > 0) return "Ducat value from local Warframe metadata.";
  return "No ducat value found in local metadata.";
}

export function buildPrimePartsFromAccount(
  items: AccountInventoryItem[],
  keepIdsOrOptions: ReadonlySet<string> | BuildPrimePartsOptions = new Set()
): PrimePart[] {
  const options: BuildPrimePartsOptions = isKeepIdSet(keepIdsOrOptions)
    ? { keepIds: keepIdsOrOptions }
    : keepIdsOrOptions;
  const keepIds = options.keepIds ?? new Set<string>();
  const sellThreshold = options.sellThreshold ?? 0.14;
  const burnThreshold = options.burnThreshold ?? 0.1;

  return items
    .filter((item) => item.category === "Prime Part" && item.quantity > 0)
    .map((item) => {
      const keep = keepIds.has(item.id);
      const componentMetadata = options.componentMetadata?.[item.id];
      const partName = displayPrimePartName(item, componentMetadata);
      const protection = options.setProtections?.[item.id];
      const protectedQuantity = keep
        ? item.quantity
        : Math.min(item.quantity, Math.max(0, protection?.protectedQuantity ?? 0));
      const convertibleQuantity = Math.max(0, item.quantity - protectedQuantity);
      const ducatValue = Math.max(0, Math.floor(item.ducatValue ?? 0));
      const marketPrice = getMarketPrice(partName, options.marketPrices);
      const marketPlatValue = marketPrice?.liquidPlatEstimate ?? 0;
      const platPerDucat = ducatValue > 0 && marketPlatValue > 0 ? marketPlatValue / ducatValue : 0;
      const recommendation = buildRecommendation({
        keep,
        ducatValue,
        marketPlatValue,
        platPerDucat,
        protectedQuantity,
        quantity: item.quantity,
        sellThreshold,
        burnThreshold,
      });
      const plannedDucatValue =
        recommendation === "Trade for Ducats" ? ducatValue * convertibleQuantity : 0;
      const marketError = options.marketErrors?.[partName] ?? marketPrice?.error;

      return {
        id: item.id,
        owned: true,
        quantity: item.quantity,
        partName,
        ducatValue,
        totalDucatValue: ducatValue * item.quantity,
        plannedDucatValue,
        marketPlatValue,
        lowestOnlineSell: marketPrice?.lowestOnlineSell,
        medianOnlineSell: marketPrice?.medianOnlineSell,
        highestBuyOrder: marketPrice?.highestBuyOrder,
        platPerDucat,
        recommendation,
        keep,
        itemType: item.itemType,
        imageName: item.imageName,
        imageUrl: item.imageUrl,
        sourceType: item.rawPath,
        valuationSource: getValuationSource(item),
        marketUrlName: marketPrice?.marketUrlName,
        marketSource: marketPrice?.source,
        marketError,
        protectedQuantity,
        convertibleQuantity,
        protectedForSetName: protection?.setName,
        setOwned: protection?.ownedSet,
        setCanCraft: protection?.canCraft,
        missingSetParts: protection?.missingSetParts,
        notes: buildNotes({ ducatValue, marketPrice, marketError, protection, recommendation }),
        lastPriceUpdate: marketPrice?.lastUpdated ?? null,
      } satisfies PrimePart;
    })
    .sort((left, right) => {
      if (left.keep !== right.keep) return Number(left.keep) - Number(right.keep);
      if (left.recommendation !== right.recommendation) {
        const order: Record<PrimePart["recommendation"], number> = {
          "Sell for Platinum": 0,
          "Trade for Ducats": 1,
          "Gray Zone": 2,
          "Protect Set": 3,
          Keep: 4,
          "Check Manually": 5,
        };
        return order[left.recommendation] - order[right.recommendation];
      }
      if (left.marketPlatValue !== right.marketPlatValue) return right.marketPlatValue - left.marketPlatValue;
      if (left.ducatValue !== right.ducatValue) return right.ducatValue - left.ducatValue;
      return left.partName.localeCompare(right.partName);
    });
}

export function summarizePrimeParts(parts: PrimePart[]) {
  return {
    uniqueParts: parts.length,
    totalCopies: parts.reduce((sum, part) => sum + part.quantity, 0),
    convertibleCopies: parts.reduce((sum, part) => sum + part.convertibleQuantity, 0),
    protectedCopies: parts.reduce((sum, part) => sum + part.protectedQuantity, 0),
    totalDucatValue: parts.reduce((sum, part) => sum + part.totalDucatValue, 0),
    tradeableDucatValue: parts.reduce((sum, part) => sum + part.plannedDucatValue, 0),
    sellForPlatinumValue: parts.reduce(
      (sum, part) =>
        sum + (part.recommendation === "Sell for Platinum" ? part.marketPlatValue * part.convertibleQuantity : 0),
      0
    ),
    keptParts: parts.filter((part) => part.keep).length,
    protectedParts: parts.filter((part) => part.recommendation === "Protect Set").length,
    sellForPlatinum: parts.filter((part) => part.recommendation === "Sell for Platinum").length,
    tradeForDucats: parts.filter((part) => part.recommendation === "Trade for Ducats").length,
    grayZone: parts.filter((part) => part.recommendation === "Gray Zone").length,
    marketPricedParts: parts.filter((part) => part.marketPlatValue > 0).length,
    marketMissingParts: parts.filter((part) => part.marketPlatValue <= 0).length,
    unknownValues: parts.filter((part) => part.ducatValue <= 0).length,
  };
}

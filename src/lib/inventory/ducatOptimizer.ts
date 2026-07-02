import type { WishlistItem } from "@/types/baro";
import type { PrimePart } from "@/types/market";

export type PlannedDucatTrade = {
  part: PrimePart;
  quantity: number;
  ducats: number;
};

export type BalancedDucatPlan = {
  targetDucats: number;
  neededDucats: number;
  plannedDucats: number;
  remainingGap: number;
  availableDucatCapacity: number;
  trades: PlannedDucatTrade[];
  protectedCopies: number;
  estimatedPlatPreserved: number;
  skippedForPricing: number;
};

function isUnavailableMarketError(error?: string) {
  return Boolean(error && (/no warframe market listing/i.test(error) || /\b404\b|not found/i.test(error)));
}

function hasRetryableMarketIssue(part: PrimePart) {
  if (!part.marketError) return false;
  return !isUnavailableMarketError(part.marketError);
}

function planSort(left: PrimePart, right: PrimePart) {
  if (left.platPerDucat !== right.platPerDucat) return left.platPerDucat - right.platPerDucat;
  if (left.ducatValue !== right.ducatValue) return right.ducatValue - left.ducatValue;
  return left.partName.localeCompare(right.partName);
}

function isEligiblePart(part: PrimePart) {
  return part.convertibleQuantity > 0 && part.ducatValue > 0 && !part.keep && !hasRetryableMarketIssue(part);
}

export function buildBalancedDucatPlan(
  parts: PrimePart[],
  wishlist: WishlistItem[],
  currentDucats: number
): BalancedDucatPlan {
  const targetDucats = wishlist.reduce((sum, item) => sum + item.totalDucats, 0);
  const neededDucats = Math.max(0, targetDucats - currentDucats);
  const preferred = parts
    .filter((part) => part.recommendation === "Trade for Ducats" && isEligiblePart(part))
    .sort(planSort);
  const backup = parts
    .filter((part) => part.recommendation === "Gray Zone" && isEligiblePart(part))
    .sort(planSort);
  const trades: PlannedDucatTrade[] = [];
  let remainingGap = neededDucats;

  for (const part of [...preferred, ...backup]) {
    if (remainingGap <= 0) break;
    const quantity = Math.min(part.convertibleQuantity, Math.ceil(remainingGap / part.ducatValue));
    if (quantity <= 0) continue;

    trades.push({
      part,
      quantity,
      ducats: quantity * part.ducatValue,
    });
    remainingGap = Math.max(0, remainingGap - quantity * part.ducatValue);
  }

  const plannedQuantityById = new Map(trades.map((trade) => [trade.part.id, trade.quantity]));

  return {
    targetDucats,
    neededDucats,
    plannedDucats: trades.reduce((sum, trade) => sum + trade.ducats, 0),
    remainingGap,
    availableDucatCapacity: [...preferred, ...backup].reduce(
      (sum, part) => sum + part.ducatValue * part.convertibleQuantity,
      0
    ),
    trades,
    protectedCopies: parts.reduce((sum, part) => sum + part.protectedQuantity, 0),
    estimatedPlatPreserved: parts.reduce((sum, part) => {
      const plannedQuantity = plannedQuantityById.get(part.id) ?? 0;
      return sum + Math.max(0, part.convertibleQuantity - plannedQuantity) * part.marketPlatValue;
    }, 0),
    skippedForPricing: parts.filter(
      (part) => part.convertibleQuantity > 0 && hasRetryableMarketIssue(part)
    ).length,
  };
}

export function buildDucatTradeList(plan: BalancedDucatPlan) {
  if (plan.trades.length === 0) return "No prime parts are currently planned for ducat trading.";

  return plan.trades
    .map(
      (trade) =>
        `${trade.quantity}x ${trade.part.partName} - ${trade.ducats.toLocaleString()} ducats (${trade.part.ducatValue} each)`
    )
    .join("\n");
}

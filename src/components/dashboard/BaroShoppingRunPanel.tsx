"use client";

import type { ReactNode } from "react";
import { Coins, Gem, PackageCheck, ShieldCheck, ShoppingBag } from "lucide-react";
import type { AccountInventoryItem, AccountInventoryStatus } from "@/types/account";
import type { WishlistItem } from "@/types/baro";
import type { BalancedDucatPlan } from "@/lib/inventory/ducatOptimizer";
import type { PrimePart } from "@/types/market";
import type { PrimePartMarketStatus } from "@/types/primePartAnalysis";

type BaroShoppingRunPanelProps = {
  wishlist: WishlistItem[];
  currentDucats: number;
  currentCredits: number;
  plan: BalancedDucatPlan;
  primeParts: PrimePart[];
  accountStatus?: AccountInventoryStatus;
  marketStatus?: PrimePartMarketStatus;
};

type OwnedWishlistItem = {
  item: WishlistItem;
  ownedCount: number;
};

type OpenWishlistItem = {
  item: WishlistItem;
  remainingQuantity: number;
  remainingDucats: number;
  remainingCredits: number;
};

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function normalizeName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function accountItemKeys(item: AccountInventoryItem) {
  return [
    normalizeName(item.name),
    normalizeName(item.itemType.split("/").filter(Boolean).at(-1) ?? item.itemType),
  ].filter(Boolean);
}

function buildAccountCounts(items: AccountInventoryItem[]) {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const key of accountItemKeys(item)) {
      counts.set(key, (counts.get(key) ?? 0) + item.quantity);
    }
  }

  return counts;
}

function getOwnedCount(item: WishlistItem, accountCounts: Map<string, number>) {
  const accountOwnedCount = accountCounts.get(normalizeName(item.itemName)) ?? item.accountOwnedCount ?? 0;
  return Math.max(item.owned ? item.quantity : 0, accountOwnedCount);
}

function getOwnedWishlistItems(wishlist: WishlistItem[], accountCounts: Map<string, number>) {
  const ownedItems: OwnedWishlistItem[] = [];

  for (const item of wishlist) {
    const ownedCount = getOwnedCount(item, accountCounts);
    if (ownedCount > 0) ownedItems.push({ item, ownedCount });
  }

  return ownedItems;
}

function getOpenWishlistItems(wishlist: WishlistItem[], accountCounts: Map<string, number>) {
  return wishlist
    .map((item): OpenWishlistItem => {
      const ownedCount = getOwnedCount(item, accountCounts);
      const remainingQuantity = Math.max(0, item.quantity - ownedCount);
      return {
        item,
        remainingQuantity,
        remainingDucats: item.ducatCost * remainingQuantity,
        remainingCredits: item.creditCost * remainingQuantity,
      };
    })
    .filter((item) => item.remainingQuantity > 0);
}

function getMarketSellParts(parts: PrimePart[]) {
  return parts
    .filter((part) => part.recommendation === "Sell for Platinum" && part.convertibleQuantity > 0)
    .toSorted((left, right) => {
      const leftValue = left.marketPlatValue * left.convertibleQuantity;
      const rightValue = right.marketPlatValue * right.convertibleQuantity;
      return rightValue - leftValue || left.partName.localeCompare(right.partName);
    });
}

export function BaroShoppingRunPanel({
  wishlist,
  currentDucats,
  currentCredits,
  plan,
  primeParts,
  accountStatus,
  marketStatus,
}: BaroShoppingRunPanelProps) {
  const wantedItems = wishlist.filter((item) => item.wanted);
  const accountCounts = buildAccountCounts(accountStatus?.items ?? []);
  const openItems = getOpenWishlistItems(wantedItems, accountCounts);
  const ownedWishlistItems = getOwnedWishlistItems(wantedItems, accountCounts);
  const ownedDucatValue = ownedWishlistItems.reduce(
    (sum, entry) => sum + Math.min(entry.ownedCount, entry.item.quantity) * entry.item.ducatCost,
    0
  );
  const ownedCreditValue = ownedWishlistItems.reduce(
    (sum, entry) => sum + Math.min(entry.ownedCount, entry.item.quantity) * entry.item.creditCost,
    0
  );
  const totalWishlistDucats = wantedItems.reduce((sum, item) => sum + item.ducatCost * item.quantity, 0);
  const openWishlistDucats = openItems.reduce((sum, entry) => sum + entry.remainingDucats, 0);
  const openWishlistCredits = openItems.reduce((sum, entry) => sum + entry.remainingCredits, 0);
  const marketSellParts = getMarketSellParts(primeParts);
  const marketSellPlat = marketSellParts.reduce(
    (sum, part) => sum + part.marketPlatValue * part.convertibleQuantity,
    0
  );
  const safeBurnCopies = plan.trades.reduce((sum, trade) => sum + trade.quantity, 0);
  const plannedCoverage = currentDucats + plan.plannedDucats;
  const currentCreditGap = Math.max(0, openWishlistCredits - currentCredits);
  const accountFreshness =
    accountStatus?.hasSnapshot && !accountStatus.isSimulated
      ? `${accountStatus.ageSeconds ?? "unknown"}s old`
      : "waiting";
  const marketAttention = marketStatus?.retryableIssues ?? marketStatus?.failed ?? 0;

  return (
    <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6" aria-label="Baro shopping run">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-yellow-300" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">Baro Shopping Run</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            One pass over what to buy, what you already own, which Prime parts are safe ducat burns,
            what should be sold for plat, and the gap left after the plan.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-black/30 px-4 py-3 text-sm">
          <p className="text-xs text-zinc-500">Account Snapshot</p>
          <p className="mt-1 font-semibold text-zinc-100">{accountFreshness}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Wishlist Cost"
          value={`${formatNumber(openWishlistDucats)}d`}
          subvalue={`${formatNumber(openWishlistCredits)} credits`}
          tone="text-yellow-300"
          icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Already Owned"
          value={ownedWishlistItems.length.toLocaleString()}
          subvalue={`${formatNumber(ownedDucatValue)}d saved`}
          tone="text-green-300"
          icon={<PackageCheck className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Current Ducats"
          value={`${formatNumber(currentDucats)}d`}
          subvalue={`${formatNumber(currentCredits)} credits`}
          tone="text-zinc-100"
          icon={<Coins className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Safe Burns"
          value={`${formatNumber(plan.plannedDucats)}d`}
          subvalue={`${safeBurnCopies.toLocaleString()} copies`}
          tone="text-cyan-300"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Market Sells"
          value={`${formatNumber(marketSellPlat)}p`}
          subvalue={`${marketSellParts.length.toLocaleString()} parts`}
          tone="text-green-300"
          icon={<Gem className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Remaining Gap"
          value={`${formatNumber(plan.remainingGap)}d`}
          subvalue={currentCreditGap > 0 ? `${formatNumber(currentCreditGap)} credits` : "credits covered"}
          tone={plan.remainingGap > 0 || currentCreditGap > 0 ? "text-red-300" : "text-green-300"}
          icon={<Coins className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <RunList
          title="Buy List"
          emptyText="No wanted Baro items are open."
          items={openItems.slice(0, 6).map((entry) => ({
            id: entry.item.id,
            primary: entry.item.itemName,
            secondary: `${entry.remainingQuantity}x ${entry.item.category}`,
            value: `${formatNumber(entry.remainingDucats)}d`,
            tone: "text-yellow-300",
          }))}
          footer={
            wantedItems.length > 0
              ? `${formatNumber(totalWishlistDucats)}d total wishlist, ${formatNumber(ownedCreditValue)} owned credits covered`
              : undefined
          }
        />

        <RunList
          title="Safe Ducat Burns"
          emptyText="No safe burns are needed or eligible."
          items={plan.trades.slice(0, 6).map((trade) => ({
            id: trade.part.id,
            primary: trade.part.partName,
            secondary: `${trade.quantity}x at ${trade.part.ducatValue}d each`,
            value: `${formatNumber(trade.ducats)}d`,
            tone: "text-cyan-300",
          }))}
          footer={
            plan.skippedForPricing > 0
              ? `${plan.skippedForPricing.toLocaleString()} parts skipped for retryable market issues`
              : `${formatNumber(plannedCoverage)}d available after planned burns`
          }
        />

        <RunList
          title="Sell For Plat"
          emptyText="No market-priced sell candidates are available."
          items={marketSellParts.slice(0, 6).map((part) => ({
            id: part.id,
            primary: part.partName,
            secondary: `${part.convertibleQuantity}x spare, ${part.ducatValue}d each`,
            value: `${formatNumber(part.marketPlatValue * part.convertibleQuantity)}p`,
            tone: "text-green-300",
          }))}
          footer={
            marketAttention > 0
              ? `${marketAttention.toLocaleString()} market entries still need refresh`
              : marketStatus?.refreshedAt
                ? `Market checked ${new Date(marketStatus.refreshedAt).toLocaleTimeString()}`
                : undefined
          }
        />
      </div>

      {plan.remainingGap > 0 && (
        <p className="mt-5 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          This run is still short by {formatNumber(plan.remainingGap)} ducats after safe burns.
          Crack more relics, lower the wishlist, or review gray-zone parts in Inventory.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  subvalue,
  tone,
  icon,
}: {
  label: string;
  value: string;
  subvalue: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="border-l border-zinc-800 pl-4">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <p className="text-sm">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{subvalue}</p>
    </div>
  );
}

function RunList({
  title,
  emptyText,
  items,
  footer,
}: {
  title: string;
  emptyText: string;
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    value: string;
    tone: string;
  }>;
  footer?: string;
}) {
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{title}</h4>
      <div className="mt-3 divide-y divide-zinc-800 border-y border-zinc-800">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{item.primary}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{item.secondary}</p>
              </div>
              <p className={`font-mono font-semibold ${item.tone}`}>{item.value}</p>
            </div>
          ))
        )}
      </div>
      {footer && <p className="mt-3 text-xs text-zinc-500">{footer}</p>}
    </div>
  );
}

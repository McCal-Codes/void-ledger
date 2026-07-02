import { WishlistItem } from "@/types/baro";
import { memo } from "react";

interface WishlistSummaryProps {
  items: WishlistItem[];
}

export const WishlistSummary = memo(function WishlistSummary({ items }: WishlistSummaryProps) {
  const activeItems = items.filter((item) => item.wanted && !item.owned);
  const totalWantedDucats = activeItems.reduce(
    (sum, item) => sum + item.ducatCost * item.quantity,
    0
  );
  const totalWantedCredits = activeItems.reduce(
    (sum, item) => sum + item.creditCost * item.quantity,
    0
  );
  const wantedItems = activeItems.length;
  const ownedItems = items.filter((item) => item.owned).length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6" role="region" aria-label="Wishlist summary">
      <h3 className="text-lg font-semibold text-white mb-4">Wishlist Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-zinc-500 text-sm">Items Wanted</p>
          <p className="text-2xl font-bold text-white" aria-live="polite">{wantedItems}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-sm">Items Owned</p>
          <p className="text-2xl font-bold text-green-400" aria-live="polite">{ownedItems}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-sm">Total Ducats</p>
          <p className="text-2xl font-bold text-yellow-400">
            {totalWantedDucats.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 text-sm">Total Credits</p>
          <p className="text-2xl font-bold text-blue-400">
            {(totalWantedCredits / 1000000).toFixed(2)}M
          </p>
        </div>
      </div>
    </div>
  );
});

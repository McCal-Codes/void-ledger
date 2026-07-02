"use client";

import { WishlistItem } from "@/types/baro";
import { Check, Trash2, X } from "lucide-react";
import { memo } from "react";
import { ItemAssetIcon } from "@/components/inventory/ItemAssetIcon";

interface WishlistTableProps {
  items: WishlistItem[];
  onToggleWanted: (id: string) => void;
  onToggleOwned: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<WishlistItem>) => void;
  onRemoveItem: (id: string) => void;
}

const PRIORITIES: WishlistItem["priority"][] = [
  "Must Have",
  "High",
  "Medium",
  "Low",
  "Skip",
];

export const WishlistTable = memo(function WishlistTable({
  items,
  onToggleWanted,
  onToggleOwned,
  onUpdateItem,
  onRemoveItem,
}: WishlistTableProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Must Have":
        return "text-red-400 bg-red-400/10";
      case "High":
        return "text-orange-400 bg-orange-400/10";
      case "Medium":
        return "text-yellow-400 bg-yellow-400/10";
      case "Low":
        return "text-blue-400 bg-blue-400/10";
      default:
        return "text-zinc-400 bg-zinc-400/10";
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden" role="table" aria-label="Wishlist items">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[960px]">
        <thead className="bg-zinc-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Want
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Own
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Priority
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Item
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Ducats
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Credits
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Qty
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Total
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {items.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-400">
                Your wishlist is empty. Add items from the shop picker or the manual form above.
              </td>
            </tr>
          ) : null}
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-zinc-800/50">
              <td className="px-4 py-4 whitespace-nowrap">
                <button
                  onClick={() => onToggleWanted(item.id)}
                  className={`p-1 rounded ${
                    item.wanted ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"
                  }`}
                  aria-label={`Toggle wanted status for ${item.itemName}`}
                  aria-pressed={item.wanted}
                >
                  {item.wanted ? <Check className="w-4 h-4" aria-hidden="true" /> : <X className="w-4 h-4" aria-hidden="true" />}
                </button>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <button
                  onClick={() => onToggleOwned(item.id)}
                  className={`p-1 rounded ${
                    item.owned ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"
                  }`}
                  aria-label={`Toggle owned status for ${item.itemName}`}
                  aria-pressed={item.owned}
                >
                  {item.owned ? <Check className="w-4 h-4" aria-hidden="true" /> : <X className="w-4 h-4" aria-hidden="true" />}
                </button>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <select
                  value={item.priority}
                  onChange={(event) =>
                    onUpdateItem(item.id, {
                      priority: event.target.value as WishlistItem["priority"],
                    })
                  }
                  className={`w-full rounded border border-transparent px-2 py-1 text-xs font-medium ${getPriorityColor(item.priority)}`}
                  aria-label={`Priority for ${item.itemName}`}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                <div className="flex min-w-0 items-center gap-3">
                  <ItemAssetIcon
                    imageUrl={item.imageUrl}
                    name={item.itemName}
                    category={item.category}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{item.itemName}</p>
                    {item.accountOwnedCount ? (
                      <p className="mt-1 text-xs text-green-300">Have x{item.accountOwnedCount}</p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-yellow-400 font-mono">
                {item.ducatCost}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-400 font-mono">
                {(item.creditCost / 1000000).toFixed(2)}M
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) =>
                    onUpdateItem(item.id, { quantity: Number(event.target.value) })
                  }
                  className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
                  aria-label={`Quantity for ${item.itemName}`}
                />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono font-semibold">
                {item.totalDucats.toLocaleString()}D / {(item.totalCredits / 1000000).toFixed(2)}M
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="inline-flex items-center justify-center rounded bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
                  aria-label={`Remove ${item.itemName}`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
});

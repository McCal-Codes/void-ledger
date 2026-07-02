"use client";

import { ItemAssetIcon } from "@/components/inventory/ItemAssetIcon";
import { getRelicImageUrl } from "@/lib/relic/relicImages";
import type { Relic } from "@/types/relic";
import { Check, X } from "lucide-react";
import { memo } from "react";

interface RelicInventoryTableProps {
  relics: Relic[];
  onToggleOwned?: (id: string) => void;
}

export const RelicInventoryTable = memo(function RelicInventoryTable({ relics, onToggleOwned }: RelicInventoryTableProps) {
  const getEraColor = (era: string) => {
    switch (era) {
      case "Lith":
        return "text-blue-400";
      case "Meso":
        return "text-green-400";
      case "Neo":
        return "text-yellow-400";
      case "Axi":
        return "text-orange-400";
      case "Requiem":
        return "text-purple-400";
      default:
        return "text-zinc-400";
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900" role="table" aria-label="Relic inventory">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[820px]">
        <thead className="bg-zinc-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Relic
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Qty
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Era
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Refinement
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Source Type
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {relics.map((relic) => (
            <tr key={relic.id} className="hover:bg-zinc-800/50">
              <td className="px-4 py-4 whitespace-nowrap">
                {onToggleOwned ? (
                  <button
                    onClick={() => onToggleOwned(relic.id)}
                    className={`rounded p-1 ${
                      relic.owned ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"
                    }`}
                    aria-label={`Toggle owned status for ${relic.name}`}
                    aria-pressed={relic.owned}
                  >
                    {relic.owned ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Have
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-white">
                <div className="flex min-w-0 items-center gap-3">
                  <ItemAssetIcon
                    imageUrl={relic.imageUrl ?? getRelicImageUrl(relic)}
                    name={relic.name}
                    category="Relic"
                    size="sm"
                  />
                  <span className="truncate font-medium">{relic.name}</span>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-white">
                {relic.quantity.toLocaleString()}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getEraColor(relic.era)}`}>
                  {relic.era}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-zinc-400">
                {relic.refinement}
              </td>
              <td className="max-w-[360px] truncate px-4 py-4 text-xs text-zinc-500">
                {relic.sourceType ?? relic.recommendedAction}
              </td>
            </tr>
          ))}
          {relics.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={6}>
                No relics match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
});

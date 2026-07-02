"use client";

import { ItemAssetIcon } from "@/components/inventory/ItemAssetIcon";
import type { PrimePart, PrimePartRecommendation } from "@/types/market";
import { Check, ExternalLink, ShieldCheck, X } from "lucide-react";

interface PrimePartTableProps {
  parts: PrimePart[];
  onToggleKeep: (id: string) => void;
}

export function PrimePartTable({ parts, onToggleKeep }: PrimePartTableProps) {
  const getRecommendationColor = (recommendation: PrimePartRecommendation) => {
    switch (recommendation) {
      case "Sell for Platinum":
        return "text-green-400 bg-green-400/10";
      case "Trade for Ducats":
        return "text-yellow-400 bg-yellow-400/10";
      case "Gray Zone":
        return "text-zinc-400 bg-zinc-400/10";
      case "Protect Set":
        return "text-cyan-300 bg-cyan-400/10";
      case "Keep":
        return "text-blue-400 bg-blue-400/10";
      case "Check Manually":
        return "text-red-300 bg-red-400/10";
      default:
        return "text-zinc-300 bg-zinc-400/10";
    }
  };

  const sourceLabel = (part: PrimePart) => {
    switch (part.valuationSource) {
      case "alecaframe-cache":
        return "AlecaFrame";
      case "inferred":
        return "Inferred";
      default:
        return "Unknown";
    }
  };

  const marketLabel = (part: PrimePart) => {
    if (part.marketPlatValue > 0) return `${part.marketPlatValue.toLocaleString()}p`;
    if (part.marketError && (/no warframe market listing/i.test(part.marketError) || /\b404\b|not found/i.test(part.marketError))) {
      return "No listing";
    }
    if (part.marketError) return "Unavailable";
    return "Not priced";
  };

  const plannedDucatLabel = (part: PrimePart) =>
    part.plannedDucatValue > 0 ? part.plannedDucatValue.toLocaleString() : "-";

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex flex-col gap-2 border-b border-zinc-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Prime Part Decisions</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Market-aware recommendations protect craftable sets before counting ducat burns.
          </p>
        </div>
        <p className="text-sm text-zinc-500">{parts.length.toLocaleString()} unique parts</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1240px]">
          <thead className="bg-zinc-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Keep
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Part
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Qty
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Protected
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Ducats
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Market
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Plat/Ducat
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Set
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Recommendation
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {parts.map((part) => (
            <tr key={part.id} className="hover:bg-zinc-800/50">
              <td className="px-4 py-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleKeep(part.id)}
                  aria-label={part.keep ? `Allow ${part.partName} for ducats` : `Keep ${part.partName}`}
                  title={part.keep ? "Allow for ducats" : "Keep this part"}
                  className={`p-1 rounded ${
                    part.keep ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {part.keep ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
              </td>
              <td className="px-4 py-4 text-sm text-white">
                <div className="flex min-w-0 items-center gap-3">
                  <ItemAssetIcon
                    imageUrl={part.imageUrl}
                    name={part.partName}
                    category="Prime Part"
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{part.partName}</p>
                    <p className="max-w-[360px] truncate text-xs text-zinc-500">
                      {sourceLabel(part)}
                      {part.marketSource ? ` + ${part.marketSource === "cache" ? "cached market" : "live market"}` : ""}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                <div className="font-mono">{part.quantity}</div>
                {part.convertibleQuantity !== part.quantity && (
                  <div className="text-xs text-zinc-500">{part.convertibleQuantity} available</div>
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-cyan-200">
                {part.protectedQuantity > 0 ? (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {part.protectedQuantity}
                  </span>
                ) : (
                  <span className="text-zinc-600">-</span>
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-yellow-400 font-mono">
                <div>{part.ducatValue > 0 ? part.ducatValue : "Unknown"}</div>
                <div className="text-xs text-zinc-500">plan {plannedDucatLabel(part)}</div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm">
                <div className="font-mono text-green-400">{marketLabel(part)}</div>
                {(part.lowestOnlineSell || part.highestBuyOrder) && (
                  <div className="text-xs text-zinc-500">
                    sell {part.lowestOnlineSell ?? 0} / buy {part.highestBuyOrder ?? 0}
                  </div>
                )}
                {part.marketUrlName && (
                  <a
                    href={`https://warframe.market/items/${part.marketUrlName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                  >
                    Market <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-zinc-300">
                {part.platPerDucat > 0 ? part.platPerDucat.toFixed(2) : "-"}
              </td>
              <td className="px-4 py-4 text-sm text-zinc-300">
                {part.protectedForSetName ? (
                  <div className="max-w-[260px]">
                    <p className="truncate text-cyan-200">{part.protectedForSetName}</p>
                    {part.setCanCraft ? (
                      <p className="text-xs text-green-300">Ready to craft</p>
                    ) : part.missingSetParts && part.missingSetParts.length > 0 ? (
                      <p className="truncate text-xs text-zinc-500">
                        Missing {part.missingSetParts.slice(0, 2).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-zinc-600">-</span>
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getRecommendationColor(part.recommendation)}`}>
                  {part.recommendation}
                </span>
                {part.notes && <p className="mt-1 max-w-[260px] truncate text-xs text-zinc-500">{part.notes}</p>}
              </td>
            </tr>
          ))}
          {parts.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={9}>
                No real prime parts are available in the current account snapshot.
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}

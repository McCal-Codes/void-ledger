import { Coins, CreditCard } from "lucide-react";
import { memo } from "react";

interface ResourceGapCardProps {
  currentDucats: number;
  currentCredits: number;
  totalWantedDucats: number;
  totalWantedCredits: number;
  plannedConversions: number;
  availableConversions: number;
}

export const ResourceGapCard = memo(function ResourceGapCard({
  currentDucats,
  currentCredits,
  totalWantedDucats,
  totalWantedCredits,
  plannedConversions,
  availableConversions,
}: ResourceGapCardProps) {
  const remainingDucats = totalWantedDucats - currentDucats - plannedConversions;
  const remainingCredits = totalWantedCredits - currentCredits;
  const ducatResult =
    remainingDucats > 0
      ? remainingDucats.toLocaleString()
      : totalWantedDucats <= currentDucats
        ? "No conversion needed"
        : "Covered by plan";

  const ducatStatus = remainingDucats <= 0 ? "text-green-400" : "text-red-400";
  const creditStatus = remainingCredits <= 0 ? "text-green-400" : "text-yellow-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6" role="region" aria-label="Resource gap summary">
      <h2 className="text-lg font-semibold text-white mb-4">Resource Gap</h2>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-yellow-400" aria-hidden="true" />
            <span className="text-zinc-400 text-sm">Ducats</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Current</span>
              <span className="text-white">{currentDucats.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Wanted</span>
              <span className="text-white">{totalWantedDucats.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Active Plan</span>
              <span className="text-white">{plannedConversions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Available Later</span>
              <span className="text-white">{availableConversions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-zinc-800">
              <span className="text-zinc-400">Remaining</span>
              <span className={ducatStatus} aria-live="polite">
                {ducatResult}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span className="text-zinc-400 text-sm">Credits</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Current</span>
              <span className="text-white">{(currentCredits / 1000000).toFixed(2)}M</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Wanted</span>
              <span className="text-white">{(totalWantedCredits / 1000000).toFixed(2)}M</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-zinc-800">
              <span className="text-zinc-400">Remaining</span>
              <span className={creditStatus} aria-live="polite">
                {remainingCredits > 0
                  ? (remainingCredits / 1000000).toFixed(2) + "M"
                  : "On Track"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

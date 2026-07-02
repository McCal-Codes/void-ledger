import { Clock, Target } from "lucide-react";
import { memo } from "react";

interface FarmingEstimateCardProps {
  ducatGap: number;
  daysRemaining: number;
  averageMinutesPerRun: number;
  expectedDucatsPerRun: number;
}

export const FarmingEstimateCard = memo(function FarmingEstimateCard({
  ducatGap,
  daysRemaining,
  averageMinutesPerRun,
  expectedDucatsPerRun,
}: FarmingEstimateCardProps) {
  const safeDucatGap = Math.max(0, ducatGap);
  const safeExpectedDucatsPerRun = Math.max(0, expectedDucatsPerRun);
  const safeDaysRemaining = Math.max(0, daysRemaining);
  const runsNeeded = safeExpectedDucatsPerRun > 0 ? safeDucatGap / safeExpectedDucatsPerRun : 0;
  const hoursNeeded = (runsNeeded * averageMinutesPerRun) / 60;
  const dailyDucatTarget = safeDaysRemaining > 0 ? safeDucatGap / safeDaysRemaining : safeDucatGap;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6" role="region" aria-label="Farming time estimates">
      <h2 className="text-lg font-semibold text-white mb-4">Farming Estimate</h2>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <span className="text-zinc-400 text-sm">Time Needed</span>
        </div>
        <div className="pl-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Runs Required</span>
            <span className="text-white font-mono">{Math.ceil(runsNeeded)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Hours Required</span>
            <span className="text-white font-mono">{hoursNeeded.toFixed(1)}h</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Target className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <span className="text-zinc-400 text-sm">Daily Target</span>
        </div>
        <div className="pl-6">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Ducats/Day</span>
            <span className="text-yellow-400 font-mono font-bold">
              {Math.ceil(dailyDucatTarget).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Days Remaining</span>
            <span className="text-white font-mono">{Math.ceil(daysRemaining)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

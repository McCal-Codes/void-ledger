import { Zap } from "lucide-react";
import { Fissure } from "@/types/fissure";
import { memo } from "react";

interface BestFissureCardProps {
  fissures: Fissure[];
}

export const BestFissureCard = memo(function BestFissureCard({ fissures }: BestFissureCardProps) {
  const recommendedFissures = fissures.filter((f) => f.recommended);
  const bestFissure = recommendedFissures[0];

  if (!bestFissure) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6" role="region" aria-label="Best fissure recommendation">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-zinc-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">Best Fissure</h2>
        </div>
        <p className="text-zinc-500 text-sm">No recommended fissures available</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6" role="region" aria-label="Best fissure recommendation">
      <div className="flex items-center gap-3 mb-4">
        <Zap className="w-5 h-5 text-yellow-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">Best Fissure</h2>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Mission</span>
          <span className="text-white font-semibold">{bestFissure.missionType}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Node</span>
          <span className="text-white">{bestFissure.node}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Tier</span>
          <span className="text-blue-400">{bestFissure.tier}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Time Left</span>
          <time className="text-yellow-400 font-mono" dateTime={bestFissure.end.toISOString()}>
            {Math.floor(bestFissure.minutesRemaining)}m
          </time>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Score</span>
          <span className="text-green-400 font-mono">
            {(bestFissure.speedScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
});

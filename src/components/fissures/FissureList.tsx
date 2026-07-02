"use client";

import type { Fissure } from "@/types/fissure";
import { Clock3, Gauge, ShieldAlert, Zap } from "lucide-react";

interface FissureListProps {
  fissures: Fissure[];
}

const TIER_STYLES: Record<string, string> = {
  Lith: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  Meso: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Neo: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  Axi: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  Requiem: "border-red-400/30 bg-red-400/10 text-red-300",
  Omnia: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
};

function getTierClass(tier: string) {
  return TIER_STYLES[tier] ?? "border-zinc-700 bg-zinc-800 text-zinc-300";
}

function getScoreClass(score: number) {
  if (score >= 0.9) return "text-green-300";
  if (score >= 0.75) return "text-yellow-300";
  if (score >= 0.5) return "text-orange-300";
  return "text-red-300";
}

function getScoreLabel(score: number) {
  if (score >= 0.9) return "Rush";
  if (score >= 0.75) return "Fast";
  if (score >= 0.5) return "Steady";
  return "Long";
}

function formatTime(minutes: number) {
  if (minutes <= 0) return "Expired";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.floor(minutes % 60);
  return `${hours}h ${remaining}m`;
}

function FissureBadges({ fissure }: { fissure: Fissure }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center rounded border px-2 py-1 text-xs font-medium ${getTierClass(fissure.tier)}`}>
        {fissure.tier}
      </span>
      {fissure.recommended && (
        <span className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          Fast
        </span>
      )}
      {fissure.isHard && (
        <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Steel Path
        </span>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between gap-3">
        <span className={`font-mono text-sm font-semibold ${getScoreClass(score)}`}>
          {(score * 100).toFixed(0)}%
        </span>
        <span className="text-xs text-zinc-500">{getScoreLabel(score)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-yellow-300 to-green-300"
          style={{ width: `${Math.max(8, Math.min(100, score * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function FissureList({ fissures }: FissureListProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Mission Board</h3>
            <p className="mt-1 text-sm text-zinc-500">{fissures.length.toLocaleString()} matching fissures</p>
          </div>
          <p className="text-xs text-zinc-500">Sorted by speed, then expiry</p>
        </div>
      </div>

      <div className="grid divide-y divide-zinc-800 md:hidden">
        {fissures.map((fissure, index) => (
          <article key={fissure.id ?? `${fissure.node}-${index}`} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-white">{fissure.missionType}</p>
                <p className="mt-1 truncate text-sm text-zinc-400">{fissure.node}</p>
              </div>
              <FissureBadges fissure={fissure} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-zinc-800 bg-black/20 px-3 py-2">
                <p className="text-xs text-zinc-500">Time Left</p>
                <p className="mt-1 font-mono text-zinc-100">{formatTime(fissure.minutesRemaining)}</p>
              </div>
              <div className="rounded border border-zinc-800 bg-black/20 px-3 py-2">
                <p className="text-xs text-zinc-500">Score</p>
                <p className={`mt-1 font-mono font-semibold ${getScoreClass(fissure.speedScore)}`}>
                  {(fissure.speedScore * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px]">
          <thead className="bg-zinc-800/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Fissure
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Mission
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Node
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {fissures.map((fissure, index) => (
              <tr key={fissure.id ?? `${fissure.node}-${index}`} className="hover:bg-zinc-800/45">
                <td className="px-4 py-4">
                  <FissureBadges fissure={fissure} />
                </td>
                <td className="px-4 py-4 text-sm font-medium text-white">{fissure.missionType}</td>
                <td className="px-4 py-4 text-sm text-zinc-300">
                  <div>{fissure.node}</div>
                  {fissure.faction !== "Unknown" && (
                    <div className="mt-1 text-xs text-zinc-500">{fissure.faction}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <span className="inline-flex items-center gap-2 font-mono text-zinc-100">
                    <Clock3 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    {formatTime(fissure.minutesRemaining)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <ScoreBar score={fissure.speedScore} />
                </td>
                <td className="px-4 py-4 text-sm text-zinc-400">
                  {fissure.notes ?? (
                    <span className="inline-flex items-center gap-2 text-zinc-500">
                      <Gauge className="h-4 w-4" aria-hidden="true" />
                      {getScoreLabel(fissure.speedScore)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fissures.length === 0 && (
        <div className="px-5 py-10 text-center text-sm text-zinc-500">No fissures match the current filters.</div>
      )}
    </section>
  );
}

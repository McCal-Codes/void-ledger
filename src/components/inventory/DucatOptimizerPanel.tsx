"use client";

import { Clipboard, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { buildDucatTradeList, type BalancedDucatPlan } from "@/lib/inventory/ducatOptimizer";
import type { PrimePart } from "@/types/market";

type DucatOptimizerPanelProps = {
  parts: PrimePart[];
  currentDucats: number;
  plan: BalancedDucatPlan;
  onMarkPlanKeep: (ids: string[]) => void;
};

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

export function DucatOptimizerPanel({
  parts,
  currentDucats,
  plan,
  onMarkPlanKeep,
}: DucatOptimizerPanelProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const plannedIds = new Set(plan.trades.map((item) => item.part.id));
  const excludedParts = parts.filter(
    (part) =>
      part.convertibleQuantity > 0 &&
      !plannedIds.has(part.id) &&
      part.recommendation !== "Trade for Ducats"
  );
  const excludedKeepIds = excludedParts.filter((part) => !part.keep).map((part) => part.id);

  async function copyTradeList() {
    const text = buildDucatTradeList(plan);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Trade list copied.");
    } catch {
      setCopyStatus(text);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-yellow-300" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">Balanced Ducat Optimizer</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Uses your wishlist need, current ducats, real account prime parts, set protection, and
            cached market prices. It avoids kept, protected, high-value, unknown, and retry-pending parts.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onMarkPlanKeep(excludedKeepIds)}
            disabled={excludedKeepIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Mark Plan as Keep
          </button>
          <button
            type="button"
            onClick={() => void copyTradeList()}
            className="inline-flex items-center justify-center gap-2 rounded border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <Clipboard className="h-4 w-4" aria-hidden="true" />
            Copy Trade List
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <Metric label="Wishlist Need" value={plan.targetDucats} tone="text-yellow-300" />
        <Metric label="Current Ducats" value={currentDucats} tone="text-white" />
        <Metric label="Planned Ducats" value={plan.plannedDucats} tone="text-green-300" />
        <Metric label="Remaining Gap" value={plan.remainingGap} tone={plan.remainingGap > 0 ? "text-red-300" : "text-green-300"} />
        <Metric label="Trade Parts" value={plan.trades.length} tone="text-blue-300" />
        <Metric label="Protected" value={plan.protectedCopies} tone="text-cyan-300" />
        <Metric label="Plat Preserved" value={plan.estimatedPlatPreserved} tone="text-green-300" />
      </div>

      {plan.skippedForPricing > 0 && (
        <p className="mt-4 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
          {plan.skippedForPricing.toLocaleString()} convertible part{plan.skippedForPricing === 1 ? "" : "s"} are skipped until
          retryable market pricing issues are refreshed.
        </p>
      )}

      <div className="mt-5 overflow-hidden rounded border border-zinc-800">
        <div className="grid grid-cols-[minmax(0,1fr)_80px_110px_110px] gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs uppercase text-zinc-500">
          <span>Part</span>
          <span>Qty</span>
          <span>Ducats</span>
          <span>Market</span>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800">
          {plan.trades.map((item) => (
            <div
              key={item.part.id}
              className="grid grid-cols-[minmax(0,1fr)_80px_110px_110px] gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{item.part.partName}</p>
                <p className="truncate text-xs text-zinc-500">{item.part.notes}</p>
              </div>
              <span className="font-mono text-zinc-200">{item.quantity}</span>
              <span className="font-mono text-yellow-300">{item.ducats.toLocaleString()}</span>
              <span className="font-mono text-green-300">
                {item.part.marketPlatValue > 0 ? `${item.part.marketPlatValue.toLocaleString()}p` : "Ducat"}
              </span>
            </div>
          ))}
          {plan.trades.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              No ducat trades are needed or eligible under the balanced rules.
            </p>
          )}
        </div>
      </div>

      {copyStatus && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-green-300" aria-live="polite">
          {copyStatus}
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{formatNumber(value)}</p>
    </div>
  );
}

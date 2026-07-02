"use client";

import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { PrimePartMarketStatus } from "@/types/primePartAnalysis";
import type { MarketPricingIssue } from "@/types/market";

type MarketRefreshMode = "retry-issues" | "refresh-stale" | "refresh-all";

type MarketPricingPanelProps = {
  status: PrimePartMarketStatus;
  isRefreshing: boolean;
  onRefresh: (mode: MarketRefreshMode) => void;
};

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}

function formatIssueStatus(status: MarketPricingIssue["status"]) {
  switch (status) {
    case "transient-error":
      return "Retryable";
    case "unavailable":
      return "No listing";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function issueTone(issue: MarketPricingIssue) {
  if (issue.status === "unavailable") return "border-zinc-700 bg-zinc-950 text-zinc-300";
  if (issue.status === "stale") return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
}

export function MarketPricingPanel({ status, isRefreshing, onRefresh }: MarketPricingPanelProps) {
  const issues = status.issues ?? [];
  const retryableIssues = status.retryableIssues ?? issues.filter((issue) => issue.retryable).length;
  const hasIssues = issues.length > 0;

  return (
    <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {retryableIssues > 0 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-300" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-300" aria-hidden="true" />
            )}
            <h3 className="text-lg font-semibold text-white">Market Pricing</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Page loads read the local Warframe Market cache only. Use these buttons when you want
            Void Ledger to call Warframe Market and update local prices.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onRefresh("retry-issues")}
            disabled={isRefreshing || retryableIssues === 0}
            className="inline-flex items-center justify-center gap-2 rounded border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Retry Issues
          </button>
          <button
            type="button"
            onClick={() => onRefresh("refresh-stale")}
            disabled={isRefreshing || (status.stale ?? 0) === 0}
            className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Stale
          </button>
          <button
            type="button"
            onClick={() => onRefresh("refresh-all")}
            disabled={isRefreshing || status.requested === 0}
            className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            All
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <Metric label="Requested" value={status.requested} tone="text-white" />
        <Metric label="Priced" value={status.priced ?? status.fromCache} tone="text-green-300" />
        <Metric label="Missing" value={status.missing} tone="text-yellow-300" />
        <Metric label="Stale" value={status.stale} tone="text-orange-300" />
        <Metric label="No Listing" value={status.unavailable} tone="text-zinc-300" />
        <Metric label="Retryable" value={retryableIssues} tone="text-cyan-300" />
        <Metric label="Fetched" value={status.fetched} tone="text-blue-300" />
      </div>

      <p className="mt-4 text-sm text-zinc-500" aria-live="polite">
        {status.message}
      </p>

      {hasIssues && (
        <div className="mt-5 overflow-hidden rounded border border-zinc-800">
          <div className="grid grid-cols-[minmax(0,1fr)_130px_90px] gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs uppercase text-zinc-500">
            <span>Part</span>
            <span>Status</span>
            <span>Retry</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800">
            {issues.map((issue) => (
              <div
                key={`${issue.slug}:${issue.status}`}
                className="grid grid-cols-[minmax(0,1fr)_130px_90px] gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{issue.partName}</p>
                  <p className="truncate text-xs text-zinc-500">{issue.error ?? issue.slug}</p>
                </div>
                <span className={`self-start rounded border px-2 py-1 text-xs ${issueTone(issue)}`}>
                  {formatIssueStatus(issue.status)}
                </span>
                <span className="text-xs text-zinc-500">{issue.retryable ? "Yes" : "No"}</span>
              </div>
            ))}
          </div>
        </div>
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
  value?: number;
  tone: string;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{formatNumber(value)}</p>
    </div>
  );
}

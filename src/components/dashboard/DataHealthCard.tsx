"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fetchJson } from "@/lib/http/json";
import type { DataHealthResponse, HealthCheckStatus } from "@/types/health";

const STATUS_TONE: Record<HealthCheckStatus, string> = {
  healthy: "text-green-300",
  degraded: "text-yellow-300",
  stale: "text-orange-300",
  waiting: "text-zinc-400",
  ignored: "text-purple-300",
  error: "text-red-300",
};

function formatOverall(value?: DataHealthResponse["overall"]) {
  if (!value) return "Checking";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAge(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "not checked";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function DataHealthCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [health, setHealth] = useState<DataHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAgeLabel, setCheckedAgeLabel] = useState("not checked");

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        setError(null);
        const body = await fetchJson<DataHealthResponse>("/api/health", { cache: "no-store" }, {
          errorMessage: "Health check failed.",
          emptyMessage: "Health check response was empty.",
          invalidMessage: "Health check response was not valid JSON.",
        });
        const checkedAtMs = new Date(body.checkedAt).getTime();
        const ageSeconds = Number.isFinite(checkedAtMs)
          ? Math.max(0, Math.round((Date.now() - checkedAtMs) / 1000))
          : null;
        if (!cancelled) {
          setHealth(body);
          setCheckedAgeLabel(formatAge(ageSeconds));
        }
      } catch (healthError) {
        if (!cancelled) {
          setError(healthError instanceof Error ? healthError.message : "Unable to load data health.");
        }
      }
    }

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const counts = useMemo(() => {
    if (!health) return { healthy: 0, attention: 0 };
    const checks = Object.values(health.checks);
    return {
      healthy: checks.filter((check) => check.status === "healthy").length,
      attention: checks.filter((check) => check.status !== "healthy").length,
    };
  }, [health]);

  const account = health?.checks.accountInventory;
  const fissures = health?.checks.fissures;
  const market = health?.checks.primeMarket;
  const overallTone =
    health?.overall === "healthy"
      ? "text-green-300"
      : health?.overall === "error"
        ? "text-red-300"
        : health?.overall === "stale"
          ? "text-orange-300"
          : "text-yellow-300";

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6" role="region" aria-label="Data health">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {health?.overall === "healthy" ? (
            <CheckCircle2 className="h-5 w-5 text-green-300" aria-hidden="true" />
          ) : error ? (
            <AlertTriangle className="h-5 w-5 text-red-300" aria-hidden="true" />
          ) : (
            <Activity className="h-5 w-5 text-yellow-300" aria-hidden="true" />
          )}
          <h2 className="text-lg font-semibold text-white">Data Health</h2>
        </div>
        <Link href="/settings#health" className="text-sm text-cyan-300 transition hover:text-cyan-200">
          Details
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className={`text-2xl font-bold ${overallTone}`}>{formatOverall(health?.overall)}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {health ? `${counts.healthy}/6 sources healthy` : "Checking live data sources..."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-zinc-500">Account</p>
              <p className={account ? STATUS_TONE[account.status] : "text-zinc-400"}>
                {account?.summary?.uniqueItems?.toLocaleString?.() ?? account?.status ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Fissures</p>
              <p className={fissures ? STATUS_TONE[fissures.status] : "text-zinc-400"}>
                {fissures?.summary?.activeFissures?.toLocaleString?.() ?? fissures?.status ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Market</p>
              <p className={market ? STATUS_TONE[market.status] : "text-zinc-400"}>
                {market?.summary?.priced?.toLocaleString?.() ?? market?.status ?? "-"}
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Last checked {checkedAgeLabel} ago.
            {counts.attention > 0 ? ` ${counts.attention} source${counts.attention === 1 ? "" : "s"} need attention.` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

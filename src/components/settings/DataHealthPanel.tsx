"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ShieldCheck, Trash2 } from "lucide-react";
import { SourceActionControls, type SourceActionId } from "@/components/data/SourceActionControls";
import { fetchJson, readResponseError } from "@/lib/http/json";
import type { DataHealthResponse, HealthCheck, HealthCheckStatus } from "@/types/health";

type ActionState = {
  label: string;
  message: string;
  type: "idle" | "loading" | "success" | "error";
};

const STATUS_STYLE: Record<HealthCheckStatus, string> = {
  healthy: "border-green-500/30 bg-green-500/10 text-green-300",
  degraded: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  stale: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  waiting: "border-zinc-700 bg-zinc-800 text-zinc-300",
  ignored: "border-purple-500/30 bg-purple-500/10 text-purple-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
};

const CHECK_ORDER: Array<keyof DataHealthResponse["checks"]> = [
  "accountInventory",
  "alecaframeCache",
  "fissures",
  "baro",
  "primeMarket",
  "googleSheet",
];

function formatStatus(value: HealthCheckStatus) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAge(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "Not checked";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function formatValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function HealthBadge({ status }: { status: HealthCheckStatus }) {
  return (
    <span className={`rounded border px-2 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {formatStatus(status)}
    </span>
  );
}

function HealthCheckCard({ check }: { check: HealthCheck }) {
  const summaryRows = Object.entries(check.summary ?? {})
    .map(([key, value]) => [key, formatValue(value)] as const)
    .filter(([, value]) => value !== null);

  return (
    <article className="rounded-lg border border-zinc-800 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-white">{check.label}</h4>
          <p className="mt-1 text-xs text-zinc-500">{formatAge(check.ageSeconds)}</p>
        </div>
        <HealthBadge status={check.status} />
      </div>
      <p className="mt-3 text-sm text-zinc-400">{check.message}</p>
      {summaryRows.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {summaryRows.slice(0, 8).map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="truncate text-xs capitalize text-zinc-500">
                {key.replace(/([A-Z])/g, " $1")}
              </dt>
              <dd className="mt-1 truncate font-medium text-zinc-200" title={String(value)}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

async function fetchHealthData() {
  return fetchJson<DataHealthResponse>("/api/health", { cache: "no-store" }, {
    errorMessage: "Health check failed.",
    emptyMessage: "Health check response was empty.",
    invalidMessage: "Health check response was not valid JSON.",
  });
}

export function DataHealthPanel({
  onAccountStatusRefresh,
}: {
  onAccountStatusRefresh?: () => Promise<void> | void;
}) {
  const [health, setHealth] = useState<DataHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<ActionState>({
    label: "Idle",
    message: "No health action run yet.",
    type: "idle",
  });

  async function refreshHealth() {
    setIsLoading(true);
    try {
      setHealth(await fetchHealthData());
    } catch (error) {
      setAction({
        label: "Health Check",
        type: "error",
        message: error instanceof Error ? error.message : "Unable to refresh data health.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function runAction(label: string, task: () => Promise<string>) {
    setAction({ label, type: "loading", message: `${label} running...` });

    try {
      const message = await task();
      setAction({ label, type: "success", message });
      await refreshHealth();
    } catch (error) {
      setAction({
        label,
        type: "error",
        message: error instanceof Error ? error.message : `${label} failed.`,
      });
    }
  }

  async function handleSourceActionCompleted(actionId: SourceActionId) {
    if (actionId === "import-inventory") {
      await onAccountStatusRefresh?.();
    }
    await refreshHealth();
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialHealth() {
      try {
        const nextHealth = await fetchHealthData();
        if (!cancelled) setHealth(nextHealth);
      } catch (error) {
        if (!cancelled) {
          setAction({
            label: "Health Check",
            type: "error",
            message: error instanceof Error ? error.message : "Unable to refresh data health.",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInitialHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  const ignoredSnapshot = health?.checks.accountInventory.status === "ignored";
  const overallLabel = health?.overall ? health.overall.charAt(0).toUpperCase() + health.overall.slice(1) : "Checking";
  const healthyCount = useMemo(
    () =>
      health
        ? Object.values(health.checks).filter((check) => check.status === "healthy").length
        : 0,
    [health]
  );

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">Source Checks</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Verifies the real local account snapshot and live public data sources without using
            demo fallback data.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-black/30 px-4 py-3">
          <p className="text-xs text-zinc-500">Overall</p>
          <p className="mt-1 text-xl font-bold text-white">{overallLabel}</p>
          {health && <p className="mt-1 text-xs text-zinc-500">{healthyCount}/6 healthy</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {health
          ? CHECK_ORDER.map((key) => <HealthCheckCard key={key} check={health.checks[key]} />)
          : Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-lg border border-zinc-800 bg-black/30" />
            ))}
      </div>

      <div className="mt-6">
        <SourceActionControls onCompleted={handleSourceActionCompleted} />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={() => void runAction("Refresh Health", async () => "Data health refreshed.")}
          disabled={isLoading || action.type === "loading"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Activity className="h-4 w-4" aria-hidden="true" />
          Recheck Health
        </button>
        <button
          type="button"
          onClick={() =>
            void runAction("Clear Ignored", async () => {
              const response = await fetch("/api/overwolf/inventory", { method: "DELETE" });
              if (!response.ok) throw new Error(await readResponseError(response, "Snapshot clear failed."));
              await onAccountStatusRefresh?.();
              return "Ignored snapshot cleared.";
            })
          }
          disabled={!ignoredSnapshot || action.type === "loading"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear Ignored Snapshot
        </button>
      </div>

      {action.type !== "idle" && (
        <p
          className={`mt-4 text-sm ${
            action.type === "error"
              ? "text-red-300"
              : action.type === "success"
                ? "text-green-300"
                : "text-zinc-500"
          }`}
          aria-live="polite"
        >
          {action.message}
        </p>
      )}
    </section>
  );
}

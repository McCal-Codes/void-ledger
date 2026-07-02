"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, PlugZap, RefreshCw, RadioTower, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/http/json";
import { useStore } from "@/lib/store/useStore";
import type { AccountInventoryStatus } from "@/types/account";

function formatAge(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "Not received";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
        active
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : "border-zinc-700 bg-zinc-800 text-zinc-400"
      }`}
    >
      {active ? <CheckCircle2 className="h-3 w-3" /> : <RadioTower className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function OverwolfBridgePanel({
  initialStatus,
  onStatusChange,
}: {
  initialStatus?: AccountInventoryStatus;
  onStatusChange?: (status: AccountInventoryStatus) => void;
}) {
  const { settings, updateSettings } = useStore();
  const [status, setStatus] = useState<AccountInventoryStatus | null>(initialStatus ?? null);
  const [isLoading, setIsLoading] = useState(!initialStatus);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    setIsLoading(true);
    setError(null);

    try {
      const nextStatus = await fetchJson<AccountInventoryStatus>("/api/overwolf/inventory?limit=0", undefined, {
        errorMessage: "Bridge check failed.",
        emptyMessage: "Bridge status response was empty.",
        invalidMessage: "Bridge status response was not valid JSON.",
      });
      setStatus(nextStatus);
      onStatusChange?.(nextStatus);
    } catch (bridgeError) {
      setError(bridgeError instanceof Error ? bridgeError.message : "Unable to check bridge");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    if (initialStatus) return undefined;

    async function loadBridgeStatus() {
      try {
        const nextStatus = await fetchJson<AccountInventoryStatus>("/api/overwolf/inventory?limit=0", undefined, {
          errorMessage: "Bridge check failed.",
          emptyMessage: "Bridge status response was empty.",
          invalidMessage: "Bridge status response was not valid JSON.",
        });
        if (!cancelled) {
          setStatus(nextStatus);
          onStatusChange?.(nextStatus);
        }
      } catch (bridgeError) {
        if (!cancelled) {
          setError(bridgeError instanceof Error ? bridgeError.message : "Unable to check bridge");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadBridgeStatus();

    return () => {
      cancelled = true;
    };
  }, [initialStatus, onStatusChange]);

  const hasSnapshot = Boolean(status?.hasSnapshot);
  const hasLiveSnapshot = Boolean(status?.hasSnapshot && !status.isSimulated);

  async function clearSnapshot() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/overwolf/inventory", { method: "DELETE" });
      if (!response.ok) throw new Error(`Snapshot clear failed: ${response.statusText}`);
      await refreshStatus();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Unable to clear snapshot");
      setIsLoading(false);
    }
  }

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 md:col-span-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">Optional Overwolf Bridge</h3>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Advanced local capture path. Most portable users should import AlecaFrame first.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshStatus()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Check
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <StatusBadge active={hasSnapshot} label="Snapshot stored" />
        <StatusBadge active={Boolean(hasLiveSnapshot && status?.summary?.uniqueItemCount)} label="Items normalized" />
        <StatusBadge active={hasLiveSnapshot} label="Live account data" />
        <StatusBadge active={settings.accountDataSource === "overwolf"} label="Selected source" />
      </div>

      {status?.isSimulated && (
        <p className="mt-4 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
          Current snapshot is simulator dry-run data, so Void Ledger is ignoring it. Use Clear
          before importing AlecaFrame or testing live capture.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-zinc-800 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white">Bridge Endpoint</h4>
          <p className="mt-3 break-all rounded bg-zinc-950 px-3 py-2 font-mono text-xs text-cyan-200">
            {status?.endpoint ?? "http://127.0.0.1:3000/api/overwolf/inventory"}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Companion source: <span className="font-mono">overwolf-bridge</span>
          </p>
        </div>

        <div className="rounded border border-zinc-800 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white">Latest Snapshot</h4>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Received</dt>
              <dd className="text-zinc-200">{formatAge(status?.ageSeconds)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Unique Items</dt>
              <dd className="text-zinc-200">{status?.summary?.uniqueItemCount ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Relics</dt>
              <dd className="text-zinc-200">{status?.summary?.relicCount ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Prime Parts</dt>
              <dd className="text-zinc-200">{status?.summary?.primePartCount ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Mods</dt>
              <dd className="text-zinc-200">{status?.summary?.modCount ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Event</dt>
              <dd className="text-zinc-200">{status?.eventType ?? "Waiting"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {hasLiveSnapshot && (
        <div className="mt-5 rounded border border-zinc-800 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white">Account Resources</h4>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <p className="text-zinc-500">Credits</p>
              <p className="font-semibold text-zinc-100">
                {(status?.resources?.credits ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Platinum</p>
              <p className="font-semibold text-zinc-100">
                {(status?.resources?.platinum ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Free Platinum</p>
              <p className="font-semibold text-zinc-100">
                {(status?.resources?.freePlatinum ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Ducats</p>
              <p className="font-semibold text-zinc-100">
                {(status?.resources?.ducats ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
          {status?.file?.path && (
            <p className="mt-3 break-all text-xs text-zinc-500">Local snapshot: {status.file.path}</p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">
          {status?.message ??
            "No bridge snapshot is stored. Import AlecaFrame for the normal portable flow, or run the bridge for advanced testing."}
        </p>
        {!hasLiveSnapshot && (
          <p className="text-xs text-zinc-500">
            If Overwolf shows Unauthorized App, sign in to Overwolf and use an account whitelisted
            for unpacked development apps.
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!hasSnapshot || isLoading}
            onClick={() => void clearSnapshot()}
            className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
          <button
            type="button"
            disabled={!hasLiveSnapshot}
            onClick={() => updateSettings({ accountDataSource: "overwolf" })}
            className="rounded border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Use Bridge Source
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}

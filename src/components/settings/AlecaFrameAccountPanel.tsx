"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, UploadCloud } from "lucide-react";
import { fetchJson } from "@/lib/http/json";
import { useStore } from "@/lib/store/useStore";
import type { AccountInventorySummary } from "@/types/account";

type FileStatus = {
  exists: boolean;
  path?: string;
  sizeBytes?: number;
  lastModified?: string;
};

type AlecaFrameStatus = {
  installed: boolean;
  localAppDataAvailable?: boolean;
  safeAccountSyncAvailable: boolean;
  accountSyncReason?: string;
  checkedPath?: string;
  setupSteps?: string[];
  discoveredSource?: string;
  dataDirectory?: FileStatus;
  staticCache?: {
    exists: boolean;
    path?: string;
    jsonFileCount: number;
    lastModified?: string;
  };
  accountCache?: {
    lastData: FileStatus;
    deltas: FileStatus;
    readableByVoidLedger: boolean;
    decryptedBytes?: number;
    code?: string;
    reason: string;
  };
  extension?: {
    exists: boolean;
    path?: string;
    version?: string;
    usesOverwolfInventoryEvents?: boolean;
    usesPluginParser?: boolean;
  };
  ignoredPrivateFiles?: string[];
  message?: string;
};

type AlecaFrameImportResult = {
  ok: boolean;
  receivedAt?: string;
  summary?: AccountInventorySummary;
  checkedPath?: string;
  setupSteps?: string[];
  error?: string;
};

function formatDate(value?: string) {
  if (!value) return "Not found";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value?: number) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
        active
          ? "bg-green-500/10 text-green-300 border border-green-500/30"
          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
      }`}
    >
      {active ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function AlecaFrameAccountPanel({
  onAccountStatusRefresh,
}: {
  onAccountStatusRefresh?: () => Promise<void> | void;
}) {
  const { settings, updateSettings } = useStore();
  const [status, setStatus] = useState<AlecaFrameStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<AlecaFrameImportResult | null>(null);

  async function refreshStatus() {
    setIsLoading(true);
    setError(null);

    try {
      setStatus(
        await fetchJson<AlecaFrameStatus>("/api/alecaframe/status", undefined, {
          errorMessage: "Status check failed.",
          emptyMessage: "AlecaFrame status response was empty.",
          invalidMessage: "AlecaFrame status response was not valid JSON.",
        })
      );
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to check AlecaFrame");
    } finally {
      setIsLoading(false);
    }
  }

  async function importCache() {
    setIsImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const body = await fetchJson<AlecaFrameImportResult>("/api/alecaframe/import", { method: "POST" }, {
        errorMessage: "AlecaFrame import failed.",
        emptyMessage: "AlecaFrame import response was empty.",
        invalidMessage: "AlecaFrame import response was not valid JSON.",
      });
      if (!body.ok) throw new Error(body.error ?? "AlecaFrame import failed.");

      updateSettings({ accountDataSource: "alecaframe" });
      setImportResult(body);
      await refreshStatus();
      await onAccountStatusRefresh?.();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Unable to import AlecaFrame cache");
    } finally {
      setIsImporting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialStatus() {
      try {
        const nextStatus = await fetchJson<AlecaFrameStatus>("/api/alecaframe/status", undefined, {
          errorMessage: "Status check failed.",
          emptyMessage: "AlecaFrame status response was empty.",
          invalidMessage: "AlecaFrame status response was not valid JSON.",
        });
        if (!cancelled) setStatus(nextStatus);
      } catch (statusError) {
        if (!cancelled) {
          setError(
            statusError instanceof Error ? statusError.message : "Unable to check AlecaFrame"
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInitialStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const canUseAlecaFrame = Boolean(status?.safeAccountSyncAvailable);
  const selectedAlecaFrame = settings.accountDataSource === "alecaframe";

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 md:col-span-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">AlecaFrame Account Data</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Import this Windows user&apos;s local AlecaFrame account cache into this portable
            Void Ledger copy.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={isLoading || isImporting}
            className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Check
          </button>
          <button
            type="button"
            onClick={() => void importCache()}
            disabled={!canUseAlecaFrame || isImporting}
            className="inline-flex items-center justify-center gap-2 rounded border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            <UploadCloud className={`h-4 w-4 ${isImporting ? "animate-pulse" : ""}`} />
            Import Cache
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatusPill
          active={status?.localAppDataAvailable !== false}
          label="Windows user session"
        />
        <StatusPill
          active={Boolean(status?.installed)}
          label="AlecaFrame found"
        />
        <StatusPill active={canUseAlecaFrame} label="Cache readable" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => updateSettings({ accountDataSource: "manual" })}
          className={`rounded border px-4 py-3 text-left transition ${
            settings.accountDataSource === "manual"
              ? "border-cyan-400 bg-cyan-500/10 text-white"
              : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <span className="block font-medium">Manual / Void Ledger</span>
          <span className="mt-1 block text-xs text-zinc-400">Use entered resources and app state.</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (canUseAlecaFrame) updateSettings({ accountDataSource: "alecaframe" });
          }}
          disabled={!canUseAlecaFrame}
          className={`rounded border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
            selectedAlecaFrame
              ? "border-cyan-400 bg-cyan-500/10 text-white"
              : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <span className="block font-medium">AlecaFrame local cache</span>
          <span className="mt-1 block text-xs text-zinc-400">Import real inventory from lastData.dat.</span>
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {importResult?.ok && (
        <p className="mt-4 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-100">
          Imported {importResult.summary?.uniqueItemCount ?? 0} unique account items from
          AlecaFrame.
        </p>
      )}

      {status && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-zinc-800 bg-black/30 p-4">
            <h4 className="text-sm font-semibold text-white">Detected Source</h4>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">AlecaFrame</dt>
                <dd className="text-zinc-200">{status.extension?.version ?? "Not found"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Static cache</dt>
                <dd className="text-zinc-200">{status.staticCache?.jsonFileCount ?? 0} JSON files</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Cache updated</dt>
                <dd className="text-zinc-200">{formatDate(status.staticCache?.lastModified)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Account cache</dt>
                <dd className="text-zinc-200">
                  {formatBytes(status.accountCache?.lastData.sizeBytes)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Readable</dt>
                <dd className="text-zinc-200">
                  {status.accountCache?.readableByVoidLedger ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Decoded JSON</dt>
                <dd className="text-zinc-200">
                  {formatBytes(status.accountCache?.decryptedBytes)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-4">
            <h4 className="text-sm font-semibold text-amber-100">Account Sync Status</h4>
            <p className="mt-3 text-sm text-amber-100/80">
              {status.accountSyncReason ?? status.message ?? "No AlecaFrame account source found."}
            </p>
            {status.setupSteps && status.setupSteps.length > 0 && (
              <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-amber-100/70">
                {status.setupSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            <div className="mt-3 space-y-1 text-xs text-zinc-500">
              <p className="break-all">Checked: {status.checkedPath ?? "No AlecaFrame path available."}</p>
              {status.discoveredSource && <p className="break-all">{status.discoveredSource}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

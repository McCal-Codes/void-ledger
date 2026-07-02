"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { Database, DownloadCloud, FileJson, RotateCcw, Upload } from "lucide-react";
import { fetchJson } from "@/lib/http/json";
import { useStore } from "@/lib/store/useStore";
import type { AccountInventoryStatus } from "@/types/account";
import type { BaroItem, WishlistItem } from "@/types/baro";
import type { PrimePart } from "@/types/market";
import type { Relic } from "@/types/relic";
import type { Settings } from "@/types/settings";

const BACKUP_SCHEMA = "void-ledger.backup.v1";

type BackupStatus = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

type BackupSettings = Partial<Omit<Settings, "relayOpenDate" | "relayCloseDate">> & {
  relayOpenDate?: string | Date;
  relayCloseDate?: string | Date;
};

type BackupPrimePart = Omit<PrimePart, "lastPriceUpdate"> & {
  lastPriceUpdate: string | Date | null;
};

type BackupBaroItem = Omit<BaroItem, "lastUpdated"> & {
  lastUpdated: string | Date;
};

type AccountBackupSnapshot = Pick<
  AccountInventoryStatus,
  | "hasSnapshot"
  | "receivedAt"
  | "source"
  | "gameId"
  | "feature"
  | "eventType"
  | "summary"
  | "resources"
  | "items"
  | "returnedItemCount"
  | "rawInventory"
>;

type VoidLedgerBackup = {
  schema: typeof BACKUP_SCHEMA;
  exportedAt: string;
  app: {
    name: "void-ledger";
    version: 1;
  };
  localState: {
    settings: Settings;
    wishlist: WishlistItem[];
    relics: Relic[];
    primeParts: PrimePart[];
    baroCatalog: BaroItem[];
  };
  accountSnapshot: AccountBackupSnapshot | null;
};

type BackupPanelProps = {
  onAccountStatusRefresh?: () => Promise<void> | void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toDate(value: unknown, fallback: Date): Date {
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPlatform(value: unknown): value is Settings["platform"] {
  return value === "pc" || value === "ps4" || value === "xb1" || value === "switch";
}

function isAccountDataSource(value: unknown): value is Settings["accountDataSource"] {
  return value === "manual" || value === "alecaframe" || value === "overwolf";
}

function reviveSettings(value: BackupSettings, currentSettings: Settings): Partial<Settings> {
  const nextSettings: Partial<Settings> = { ...value } as Partial<Settings>;

  if (!isPlatform(nextSettings.platform)) {
    delete nextSettings.platform;
  }

  if (!isAccountDataSource(nextSettings.accountDataSource)) {
    delete nextSettings.accountDataSource;
  }

  nextSettings.relayOpenDate = toDate(value.relayOpenDate, currentSettings.relayOpenDate);
  nextSettings.relayCloseDate = toDate(value.relayCloseDate, currentSettings.relayCloseDate);

  return nextSettings;
}

function revivePrimeParts(items: BackupPrimePart[]): PrimePart[] {
  return items.map((item) => ({
    ...item,
    lastPriceUpdate: toNullableDate(item.lastPriceUpdate),
  }));
}

function reviveBaroCatalog(items: BackupBaroItem[]): BaroItem[] {
  return items.map((item) => ({
    ...item,
    lastUpdated: toDate(item.lastUpdated, new Date()),
  }));
}

function parseBackupFile(text: string): VoidLedgerBackup {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }

  if (!isRecord(parsed) || parsed.schema !== BACKUP_SCHEMA || !isRecord(parsed.localState)) {
    throw new Error("Backup file is not a Void Ledger JSON backup.");
  }

  return parsed as VoidLedgerBackup;
}

function toBackupAccountSnapshot(status: AccountInventoryStatus): AccountBackupSnapshot | null {
  if (!status.hasSnapshot || status.rawInventory === undefined || status.rawInventory === null) {
    return null;
  }

  return {
    hasSnapshot: status.hasSnapshot,
    receivedAt: status.receivedAt,
    source: status.source,
    gameId: status.gameId,
    feature: status.feature,
    eventType: status.eventType,
    summary: status.summary,
    resources: status.resources,
    items: status.items,
    returnedItemCount: status.returnedItemCount,
    rawInventory: status.rawInventory,
  };
}

function downloadBackup(backup: VoidLedgerBackup) {
  const timestamp = backup.exportedAt.replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `void-ledger-backup-${timestamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-zinc-800 bg-black/30 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

export function BackupPanel({ onAccountStatusRefresh }: BackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    settings,
    wishlist,
    relics,
    primeParts,
    baroCatalog,
    updateSettings,
    updateWishlist,
    updateRelics,
    updatePrimeParts,
    updateBaroCatalog,
  } = useStore();
  const [restoreAccountSnapshot, setRestoreAccountSnapshot] = useState(true);
  const [status, setStatus] = useState<BackupStatus>({
    type: "idle",
    message: "No backup saved this session",
  });

  const isBusy = status.type === "loading";

  const exportBackup = async () => {
    setStatus({ type: "loading", message: "Creating JSON backup..." });

    try {
      const accountStatus = await fetchJson<AccountInventoryStatus>(
        "/api/overwolf/inventory?limit=5000&includeRaw=1",
        { cache: "no-store" },
        {
          errorMessage: "Account snapshot export failed.",
          emptyMessage: "Account snapshot export response was empty.",
          invalidMessage: "Account snapshot export response was not valid JSON.",
        }
      );
      const accountSnapshot = toBackupAccountSnapshot(accountStatus);
      const backup: VoidLedgerBackup = {
        schema: BACKUP_SCHEMA,
        exportedAt: new Date().toISOString(),
        app: {
          name: "void-ledger",
          version: 1,
        },
        localState: {
          settings,
          wishlist,
          relics,
          primeParts,
          baroCatalog,
        },
        accountSnapshot,
      };

      downloadBackup(backup);
      setStatus({
        type: "success",
        message: `Saved JSON backup with ${wishlist.length} wishlist item${
          wishlist.length === 1 ? "" : "s"
        }${accountSnapshot ? " and an account snapshot" : ""}.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save backup.",
      });
    }
  };

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus({ type: "loading", message: "Restoring JSON backup..." });

    try {
      const backup = parseBackupFile(await file.text());
      const restoredSections: string[] = [];

      if (isRecord(backup.localState.settings)) {
        updateSettings(reviveSettings(backup.localState.settings as BackupSettings, settings));
        restoredSections.push("settings");
      }

      if (Array.isArray(backup.localState.wishlist)) {
        updateWishlist(backup.localState.wishlist);
        restoredSections.push(`${backup.localState.wishlist.length} wishlist item${
          backup.localState.wishlist.length === 1 ? "" : "s"
        }`);
      }

      if (Array.isArray(backup.localState.relics)) {
        updateRelics(backup.localState.relics);
        restoredSections.push(`${backup.localState.relics.length} relics`);
      }

      if (Array.isArray(backup.localState.primeParts)) {
        updatePrimeParts(revivePrimeParts(backup.localState.primeParts as BackupPrimePart[]));
        restoredSections.push(`${backup.localState.primeParts.length} prime parts`);
      }

      if (Array.isArray(backup.localState.baroCatalog)) {
        updateBaroCatalog(reviveBaroCatalog(backup.localState.baroCatalog as BackupBaroItem[]));
        restoredSections.push(`${backup.localState.baroCatalog.length} catalog rows`);
      }

      let restoredAccount = false;
      if (
        restoreAccountSnapshot &&
        backup.accountSnapshot?.rawInventory !== undefined &&
        backup.accountSnapshot.rawInventory !== null
      ) {
        await fetchJson<{ ok: boolean }>("/api/overwolf/inventory", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: "void-ledger-backup",
            eventType: "backup-restore",
            gameId: backup.accountSnapshot.gameId,
            feature: backup.accountSnapshot.feature ?? "inventory",
            rawInventory: backup.accountSnapshot.rawInventory,
          }),
        }, {
          errorMessage: "Account snapshot restore failed.",
          emptyMessage: "Account snapshot restore response was empty.",
          invalidMessage: "Account snapshot restore response was not valid JSON.",
        });

        restoredAccount = true;
        await onAccountStatusRefresh?.();
      }

      const restoredLabel =
        restoredSections.length > 0 ? restoredSections.join(", ") : "local state";
      setStatus({
        type: "success",
        message: `Restored ${restoredLabel}${restoredAccount ? " and account snapshot" : ""}.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to restore backup.",
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 md:col-span-2">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <FileJson className="mt-1 h-5 w-5 text-cyan-300" aria-hidden="true" />
          <div>
            <h3 className="mb-2 text-lg font-semibold text-white">JSON Backup</h3>
            <p className="max-w-2xl text-sm text-zinc-400">
              Save wishlist, planning settings, imported item data, and the current account
              snapshot in one portable file.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded border border-zinc-800 bg-black/30 px-3 py-1 text-xs text-zinc-400">
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          {BACKUP_SCHEMA}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryMetric label="Wishlist" value={wishlist.length} />
        <SummaryMetric label="Catalog" value={baroCatalog.length} />
        <SummaryMetric label="Relics" value={relics.length} />
        <SummaryMetric label="Prime Parts" value={primeParts.length} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
        <button
          type="button"
          onClick={exportBackup}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <DownloadCloud className="h-4 w-4" aria-hidden="true" />
          Save JSON Backup
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded bg-zinc-800 px-4 py-2 text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Restore JSON
        </button>
        <label className="inline-flex items-center justify-center gap-2 rounded border border-zinc-800 bg-black/30 px-4 py-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={restoreAccountSnapshot}
            onChange={(event) => setRestoreAccountSnapshot(event.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          Account snapshot
        </label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={restoreBackup}
        className="sr-only"
        aria-label="Restore Void Ledger JSON backup"
      />

      <p
        className={`mt-4 flex items-center gap-2 text-sm ${
          status.type === "error"
            ? "text-red-400"
            : status.type === "success"
              ? "text-green-400"
              : "text-zinc-500"
        }`}
        aria-live="polite"
      >
        {status.type === "loading" && (
          <RotateCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {status.message}
      </p>
    </section>
  );
}

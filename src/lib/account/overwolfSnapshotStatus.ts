import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { enrichAccountInventorySnapshot } from "@/lib/account/accountItemAssets";
import { buildAccountInventorySnapshot } from "@/lib/account/overwolfInventory";
import type { AccountInventorySnapshot, AccountInventoryStatus } from "@/types/account";

const DATA_DIR = path.join(process.cwd(), ".void-ledger");
const SNAPSHOT_PATH = path.join(DATA_DIR, "overwolf-inventory.json");
const ENDPOINT = "http://127.0.0.1:3000/api/overwolf/inventory";

function isSimulatedSnapshot(snapshot: Pick<AccountInventorySnapshot, "source" | "eventType">) {
  return (
    snapshot.source.toLowerCase().includes("simulator") ||
    snapshot.eventType?.toLowerCase() === "simulated"
  );
}

function normalizeStoredSnapshot(value: unknown): AccountInventorySnapshot | null {
  if (!value || typeof value !== "object") return null;

  const snapshot = value as Partial<AccountInventorySnapshot>;
  if (snapshot.rawInventory === undefined || snapshot.rawInventory === null) return null;

  if (Array.isArray(snapshot.items) && snapshot.summary?.uniqueItemCount !== undefined) {
    return snapshot as AccountInventorySnapshot;
  }

  return buildAccountInventorySnapshot({
    source: typeof snapshot.source === "string" ? snapshot.source : "void-ledger-overwolf-bridge",
    receivedAt: typeof snapshot.receivedAt === "string" ? snapshot.receivedAt : new Date().toISOString(),
    gameId: typeof snapshot.gameId === "number" ? snapshot.gameId : undefined,
    feature: typeof snapshot.feature === "string" ? snapshot.feature : "inventory",
    eventType: typeof snapshot.eventType === "string" ? snapshot.eventType : undefined,
    rawInventory: snapshot.rawInventory,
  });
}

async function readSnapshot(): Promise<AccountInventorySnapshot | null> {
  try {
    const snapshot = normalizeStoredSnapshot(JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")));
    return snapshot ? enrichAccountInventorySnapshot(snapshot) : null;
  } catch {
    return null;
  }
}

async function getSnapshotMetadata() {
  try {
    const fileInfo = await stat(SNAPSHOT_PATH);
    return {
      path: SNAPSHOT_PATH,
      sizeBytes: fileInfo.size,
      lastModified: fileInfo.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getOverwolfInventoryStatus({
  includeRaw = false,
  limit = 100,
}: {
  includeRaw?: boolean;
  limit?: number;
} = {}): Promise<AccountInventoryStatus> {
  const [snapshot, metadata] = await Promise.all([readSnapshot(), getSnapshotMetadata()]);

  if (!snapshot || !metadata) {
    return {
      connected: false,
      hasSnapshot: false,
      endpoint: ENDPOINT,
      message:
        "No account inventory snapshot is saved in this local copy yet. Import AlecaFrame, restore a JSON backup, or continue with manual planning.",
    };
  }

  const receivedAtMs = new Date(snapshot.receivedAt).getTime();
  const ageSeconds = Number.isFinite(receivedAtMs)
    ? Math.max(0, Math.round((Date.now() - receivedAtMs) / 1000))
    : null;
  const safeLimit = Math.max(0, Math.min(5000, Math.floor(limit)));
  const isSimulated = isSimulatedSnapshot(snapshot);

  if (isSimulated) {
    return {
      connected: false,
      hasSnapshot: false,
      isSimulated: true,
      endpoint: ENDPOINT,
      receivedAt: snapshot.receivedAt,
      ageSeconds,
      file: metadata,
      message:
        "Ignoring simulator dry-run data. Clear the snapshot, then import AlecaFrame or restore a real JSON backup.",
    };
  }

  return {
    connected: true,
    hasSnapshot: true,
    isSimulated,
    endpoint: ENDPOINT,
    receivedAt: snapshot.receivedAt,
    ageSeconds,
    source: snapshot.source,
    gameId: snapshot.gameId,
    feature: snapshot.feature,
    eventType: snapshot.eventType,
    summary: snapshot.summary,
    resources: snapshot.resources,
    items: snapshot.items.slice(0, safeLimit),
    returnedItemCount: Math.min(safeLimit, snapshot.items.length),
    file: metadata,
    rawInventory: includeRaw ? snapshot.rawInventory : undefined,
  };
}

import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { enrichAccountInventorySnapshot } from "@/lib/account/accountItemAssets";
import { buildAccountInventorySnapshot } from "@/lib/account/overwolfInventory";
import type { AccountInventorySnapshot } from "@/types/account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), ".void-ledger");
const SNAPSHOT_PATH = path.join(DATA_DIR, "overwolf-inventory.json");

function isSimulatedSnapshot(snapshot: Pick<AccountInventorySnapshot, "source" | "eventType">) {
  return (
    snapshot.source.toLowerCase().includes("simulator") ||
    snapshot.eventType?.toLowerCase() === "simulated"
  );
}

function getSnapshotSource(body: Record<string, unknown>) {
  return typeof body.source === "string" ? body.source : "void-ledger-overwolf-bridge";
}

function getSnapshotEventType(body: Record<string, unknown>) {
  return typeof body.eventType === "string" ? body.eventType : undefined;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(),
      ...init?.headers,
    },
  });
}

function extractInventoryPayload(body: Record<string, unknown>) {
  const nestedInfo = body.info as { match_info?: { inventory?: unknown } } | undefined;
  return (
    body.inventory ??
    body.rawInventory ??
    body.payload ??
    body.data ??
    nestedInfo?.match_info?.inventory
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

function getLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(5000, Math.floor(value)));
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const snapshot = await readSnapshot();
  const metadata = await getSnapshotMetadata();
  const includeRaw = request.nextUrl.searchParams.get("includeRaw") === "1";
  const limit = getLimit(request);

  if (!snapshot || !metadata) {
    return jsonResponse({
      connected: false,
      hasSnapshot: false,
      endpoint: "http://127.0.0.1:3000/api/overwolf/inventory",
      message:
        "No account inventory snapshot is saved in this local copy yet. Import AlecaFrame, restore a JSON backup, or continue with manual planning.",
    });
  }

  const receivedAtMs = new Date(snapshot.receivedAt).getTime();
  const ageSeconds = Number.isFinite(receivedAtMs)
    ? Math.max(0, Math.round((Date.now() - receivedAtMs) / 1000))
    : null;
  const isSimulated = isSimulatedSnapshot(snapshot);

  if (isSimulated) {
    return jsonResponse({
      connected: false,
      hasSnapshot: false,
      isSimulated: true,
      endpoint: "http://127.0.0.1:3000/api/overwolf/inventory",
      receivedAt: snapshot.receivedAt,
      ageSeconds,
      file: metadata,
      message:
        "Ignoring simulator dry-run data. Clear the snapshot, then import AlecaFrame or restore a real JSON backup.",
    });
  }

  return jsonResponse({
    connected: true,
    hasSnapshot: true,
    isSimulated,
    endpoint: "http://127.0.0.1:3000/api/overwolf/inventory",
    receivedAt: snapshot.receivedAt,
    ageSeconds,
    source: snapshot.source,
    gameId: snapshot.gameId,
    feature: snapshot.feature,
    eventType: snapshot.eventType,
    summary: snapshot.summary,
    resources: snapshot.resources,
    items: snapshot.items.slice(0, limit),
    returnedItemCount: Math.min(limit, snapshot.items.length),
    file: metadata,
    rawInventory: includeRaw ? snapshot.rawInventory : undefined,
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Expected JSON request body." }, { status: 400 });
  }

  const rawInventory = extractInventoryPayload(body);
  const source = getSnapshotSource(body);
  const eventType = getSnapshotEventType(body);
  const isDryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  if (rawInventory === undefined || rawInventory === null) {
    return jsonResponse(
      {
        ok: false,
        error: "No inventory payload found. Send inventory, rawInventory, payload, data, or info.match_info.inventory.",
      },
      { status: 400 }
    );
  }

  if (!isDryRun && isSimulatedSnapshot({ source, eventType })) {
    return jsonResponse(
      {
        ok: false,
        error: "Simulator payloads are only accepted with ?dryRun=1 and are never saved as account inventory.",
      },
      { status: 409 }
    );
  }

  const snapshot = await enrichAccountInventorySnapshot(
    buildAccountInventorySnapshot({
      source,
      receivedAt: new Date().toISOString(),
      gameId: typeof body.gameId === "number" ? body.gameId : undefined,
      feature: typeof body.feature === "string" ? body.feature : "inventory",
      eventType,
      rawInventory,
    })
  );

  if (isDryRun) {
    return jsonResponse({
      ok: true,
      dryRun: true,
      isSimulated: isSimulatedSnapshot(snapshot),
      receivedAt: snapshot.receivedAt,
      summary: snapshot.summary,
      resources: snapshot.resources,
      items: snapshot.items,
    });
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf8");

  return jsonResponse({
    ok: true,
    receivedAt: snapshot.receivedAt,
    summary: snapshot.summary,
  });
}

export async function DELETE() {
  try {
    await unlink(SNAPSHOT_PATH);
  } catch {
    return jsonResponse({ ok: true, cleared: false, message: "No snapshot was present." });
  }

  return jsonResponse({ ok: true, cleared: true });
}

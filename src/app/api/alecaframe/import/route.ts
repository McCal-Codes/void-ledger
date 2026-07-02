import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { AlecaFrameCacheError, readAlecaFrameLastDataCache } from "@/lib/account/alecaframeCache";
import { enrichAccountInventorySnapshot } from "@/lib/account/accountItemAssets";
import { buildAccountInventorySnapshot } from "@/lib/account/overwolfInventory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), ".void-ledger");
const SNAPSHOT_PATH = path.join(DATA_DIR, "overwolf-inventory.json");

function importSetupSteps(error: AlecaFrameCacheError) {
  if (error.code === "LOCALAPPDATA_MISSING") {
    return [
      "Start Void Ledger with scripts\\start-windows.ps1 from your Windows account.",
      "Do not run the app as a different Windows user when importing AlecaFrame data.",
    ];
  }

  if (error.code === "CACHE_FILE_MISSING") {
    return [
      "Open AlecaFrame for this Windows account.",
      "Launch Warframe and wait until AlecaFrame has loaded account data.",
      "Return to Settings and click Check, then Import Cache.",
    ];
  }

  return [
    "Close and reopen AlecaFrame, then load Warframe once.",
    "Click Check in Settings to confirm lastData.dat is readable before importing.",
  ];
}

function importStatusFor(error: AlecaFrameCacheError) {
  if (error.code === "LOCALAPPDATA_MISSING" || error.code === "CACHE_FILE_MISSING") {
    return 409;
  }

  if (error.code === "CACHE_FILE_UNREADABLE") {
    return 403;
  }

  return 422;
}

export async function POST() {
  try {
    const cache = await readAlecaFrameLastDataCache();
    const snapshot = await enrichAccountInventorySnapshot(
      buildAccountInventorySnapshot({
        source: "alecaframe-cache",
        receivedAt: cache.cacheFile.lastModified,
        feature: "inventory",
        eventType: "alecaframe-cache-import",
        rawInventory: cache.rawInventory,
      })
    );

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf8");

    return NextResponse.json({
      ok: true,
      receivedAt: snapshot.receivedAt,
      source: snapshot.source,
      eventType: snapshot.eventType,
      summary: snapshot.summary,
      resources: snapshot.resources,
      cacheFile: cache.cacheFile,
      decryptedBytes: cache.decryptedBytes,
      snapshotPath: SNAPSHOT_PATH,
    });
  } catch (error) {
    if (error instanceof AlecaFrameCacheError) {
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          error: error.message,
          checkedPath: error.cachePath,
          dataDirectory: error.dataDirectory,
          setupSteps: importSetupSteps(error),
        },
        { status: importStatusFor(error) }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to import AlecaFrame cache.",
      },
      { status: 500 }
    );
  }
}

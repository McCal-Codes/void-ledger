import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  AlecaFrameCacheError,
  getAlecaFrameDataDirectory,
  getAlecaFrameLastDataPath,
  readAlecaFrameLastDataCache,
} from "@/lib/account/alecaframeCache";

type FileStatus = {
  exists: boolean;
  path?: string;
  sizeBytes?: number;
  lastModified?: string;
};

type AlecaFrameExtension = {
  exists: boolean;
  path?: string;
  version?: string;
  usesOverwolfInventoryEvents?: boolean;
  usesPluginParser?: boolean;
};

type CacheDecodeStatus = {
  readable: boolean;
  decryptedBytes?: number;
  error?: string;
  code?: string;
  checkedPath?: string;
  dataDirectory?: string | null;
};

const ALECAFRAME_APP_ID = "afmcagbpgggkpdkokjhjkllpegnadmkignlonpjm";

async function getFileStatus(filePath: string): Promise<FileStatus> {
  try {
    const info = await stat(filePath);
    return {
      exists: true,
      path: filePath,
      sizeBytes: info.size,
      lastModified: info.mtime.toISOString(),
    };
  } catch {
    return { exists: false, path: filePath };
  }
}

async function getDirectoryLatestModified(directoryPath: string): Promise<string | undefined> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    let latest = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fileInfo = await stat(path.join(directoryPath, entry.name));
      latest = Math.max(latest, fileInfo.mtime.getTime());
    }

    return latest > 0 ? new Date(latest).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

async function countJsonFiles(directoryPath: string): Promise<number> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .length;
  } catch {
    return 0;
  }
}

async function findAlecaFrameExtension(localAppData: string): Promise<AlecaFrameExtension> {
  const knownExtensionRoot = path.join(localAppData, "Overwolf", "Extensions", ALECAFRAME_APP_ID);

  try {
    const versions = await readdir(knownExtensionRoot, { withFileTypes: true });
    const versionDirectories = versions
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    for (const version of versionDirectories) {
      const extensionPath = path.join(knownExtensionRoot, version);
      const manifestPath = path.join(extensionPath, "manifest.json");
      const manifestRaw = await readFile(manifestPath, "utf8");
      const manifest = JSON.parse(manifestRaw) as { meta?: { name?: string; version?: string } };

      if (manifest.meta?.name !== "AlecaFrame") continue;

      const backgroundPath = path.join(extensionPath, "web", "assets", "js", "background.js");
      const background = await readFile(backgroundPath, "utf8").catch(() => "");

      return {
        exists: true,
        path: extensionPath,
        version: manifest.meta.version,
        usesOverwolfInventoryEvents:
          background.includes("match_info.inventory") &&
          background.includes("overwolf.games.events"),
        usesPluginParser: background.includes("SetWarframeData"),
      };
    }
  } catch {
    return { exists: false, path: knownExtensionRoot };
  }

  return { exists: false, path: knownExtensionRoot };
}

async function getCacheDecodeStatus(): Promise<CacheDecodeStatus> {
  try {
    const cache = await readAlecaFrameLastDataCache();
    return {
      readable: true,
      decryptedBytes: cache.decryptedBytes,
      checkedPath: cache.cacheFile.path,
    };
  } catch (error) {
    if (error instanceof AlecaFrameCacheError) {
      return {
        readable: false,
        error: error.message,
        code: error.code,
        checkedPath: error.cachePath,
        dataDirectory: error.dataDirectory,
      };
    }

    return {
      readable: false,
      error: error instanceof Error ? error.message : "Unable to decode AlecaFrame cache.",
      checkedPath: getAlecaFrameLastDataPath() ?? undefined,
      dataDirectory: getAlecaFrameDataDirectory(),
    };
  }
}

function buildAccountSyncReason({
  installed,
  safeAccountSyncAvailable,
  lastData,
  cacheDecode,
}: {
  installed: boolean;
  safeAccountSyncAvailable: boolean;
  lastData: FileStatus;
  cacheDecode: CacheDecodeStatus;
}) {
  if (safeAccountSyncAvailable) {
    return "Ready. Import Cache will copy this Windows user's AlecaFrame inventory into this local Void Ledger folder.";
  }

  if (cacheDecode.code === "LOCALAPPDATA_MISSING") {
    return "Void Ledger is not running inside a normal Windows user session, so it cannot locate AlecaFrame under LOCALAPPDATA.";
  }

  if (!installed) {
    return "AlecaFrame was not found for this Windows user. Manual planning and JSON restore still work.";
  }

  if (!lastData.exists) {
    return `Void Ledger checked ${lastData.path ?? "the AlecaFrame data folder"}, but lastData.dat is not available yet. Open Warframe with AlecaFrame running, then check again.`;
  }

  return cacheDecode.error ?? "AlecaFrame was detected, but its account cache is not readable right now.";
}

function setupSteps(cacheDecode: CacheDecodeStatus, safeAccountSyncAvailable: boolean) {
  if (safeAccountSyncAvailable) {
    return [
      "Click Import Cache to save a Void Ledger account snapshot.",
      "Use JSON Backup if you want to move this local data to another copy.",
    ];
  }

  if (cacheDecode.code === "LOCALAPPDATA_MISSING") {
    return [
      "Start Void Ledger with scripts\\start-windows.ps1 from your Windows account.",
      "Avoid running the app as a service or another user when importing AlecaFrame data.",
    ];
  }

  return [
    "Install or open AlecaFrame for this Windows account.",
    "Launch Warframe with AlecaFrame running until AlecaFrame has loaded account data.",
    "Return to Void Ledger Settings and click Check, then Import Cache.",
  ];
}

export async function GET() {
  const localAppData = process.env.LOCALAPPDATA;
  const dataPath = getAlecaFrameDataDirectory();
  const lastDataPath = getAlecaFrameLastDataPath();

  if (!localAppData) {
    const cacheDecode = await getCacheDecodeStatus();
    return NextResponse.json(
      {
        installed: false,
        localAppDataAvailable: false,
        safeAccountSyncAvailable: false,
        checkedPath: lastDataPath,
        setupSteps: setupSteps(cacheDecode, false),
        accountSyncReason: buildAccountSyncReason({
          installed: false,
          safeAccountSyncAvailable: false,
          lastData: { exists: false, path: lastDataPath ?? undefined },
          cacheDecode,
        }),
        dataDirectory: { exists: false, path: dataPath ?? undefined },
        accountCache: {
          lastData: { exists: false, path: lastDataPath ?? undefined },
          deltas: { exists: false },
          readableByVoidLedger: false,
          reason: cacheDecode.error ?? "LOCALAPPDATA is not available to the server process.",
        },
        message: cacheDecode.error ?? "LOCALAPPDATA is not available to the server process.",
      },
      { status: 200 }
    );
  }

  const checkedDataPath = dataPath ?? path.join(localAppData, "AlecaFrame");
  const checkedLastDataPath = lastDataPath ?? path.join(checkedDataPath, "lastData.dat");
  const staticJsonPath = path.join(checkedDataPath, "cachedData", "json");
  const extension = await findAlecaFrameExtension(localAppData);
  const [dataDirectory, lastData, deltas, staticFileCount, staticLastModified, cacheDecode] =
    await Promise.all([
      getFileStatus(checkedDataPath),
      getFileStatus(checkedLastDataPath),
      getFileStatus(path.join(checkedDataPath, "deltas.dat")),
      countJsonFiles(staticJsonPath),
      getDirectoryLatestModified(staticJsonPath),
      getCacheDecodeStatus(),
    ]);

  const installed = dataDirectory.exists || extension.exists;
  const safeAccountSyncAvailable = Boolean(lastData.exists && cacheDecode.readable);

  return NextResponse.json({
    installed,
    localAppDataAvailable: true,
    safeAccountSyncAvailable,
    checkedPath: checkedLastDataPath,
    setupSteps: setupSteps(cacheDecode, safeAccountSyncAvailable),
    accountSyncReason:
      buildAccountSyncReason({ installed, safeAccountSyncAvailable, lastData, cacheDecode }),
    discoveredSource:
      extension.usesOverwolfInventoryEvents
        ? "overwolf.games.events match_info.inventory -> AlecaFrameClientLib.SetWarframeData"
        : undefined,
    dataDirectory,
    staticCache: {
      exists: staticFileCount > 0,
      path: staticJsonPath,
      jsonFileCount: staticFileCount,
      lastModified: staticLastModified,
    },
    accountCache: {
      lastData,
      deltas,
      readableByVoidLedger: cacheDecode.readable,
      decryptedBytes: cacheDecode.decryptedBytes,
      code: cacheDecode.code,
      reason: cacheDecode.readable
        ? "The local lastData.dat cache decrypts to Warframe account JSON."
        : cacheDecode.error ?? "The account cache is not readable.",
    },
    extension,
    ignoredPrivateFiles: ["WFMarketToken.tk"],
  });
}

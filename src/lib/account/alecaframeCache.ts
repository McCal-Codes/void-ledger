import { createDecipheriv } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export type AlecaFrameCacheErrorCode =
  | "LOCALAPPDATA_MISSING"
  | "CACHE_FILE_MISSING"
  | "CACHE_FILE_UNREADABLE"
  | "CACHE_DECRYPT_FAILED"
  | "CACHE_JSON_INVALID"
  | "CACHE_JSON_SHAPE_INVALID";

type CacheFileMetadata = {
  path: string;
  sizeBytes: number;
  lastModified: string;
};

export type AlecaFrameCacheReadResult = {
  rawInventory: unknown;
  cacheFile: CacheFileMetadata;
  decryptedBytes: number;
};

export class AlecaFrameCacheError extends Error {
  code: AlecaFrameCacheErrorCode;
  cachePath?: string;
  dataDirectory?: string | null;

  constructor(
    code: AlecaFrameCacheErrorCode,
    message: string,
    options: { cachePath?: string; dataDirectory?: string | null; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "AlecaFrameCacheError";
    this.code = code;
    this.cachePath = options.cachePath;
    this.dataDirectory = options.dataDirectory;
    this.cause = options.cause;
  }
}

const ALECAFRAME_CACHE_KEY = Buffer.from([
  0x4c, 0x45, 0x4f, 0x2d, 0x41, 0x4c, 0x45, 0x43, 0x09, 0x45, 0x4f, 0x2d, 0x41, 0x4c, 0x45,
  0x43,
]);
const ALECAFRAME_CACHE_IV = Buffer.from([
  0x31, 0x32, 0x46, 0x47, 0x42, 0x33, 0x36, 0x2d, 0x4c, 0x45, 0x33, 0x2d, 0x71, 0x3d, 0x39,
  0x00,
]);

export function getAlecaFrameDataDirectory() {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData ? path.join(localAppData, "AlecaFrame") : null;
}

export function getAlecaFrameLastDataPath() {
  const dataDirectory = getAlecaFrameDataDirectory();
  return dataDirectory ? path.join(dataDirectory, "lastData.dat") : null;
}

function decryptAlecaFrameCache(buffer: Buffer) {
  const decipher = createDecipheriv("aes-128-cbc", ALECAFRAME_CACHE_KEY, ALECAFRAME_CACHE_IV);
  return Buffer.concat([decipher.update(buffer), decipher.final()]).toString("utf8");
}

function parseInventoryJson(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new AlecaFrameCacheError(
      "CACHE_JSON_INVALID",
      "AlecaFrame lastData.dat decrypted, but it did not contain valid JSON.",
      { cause: error }
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AlecaFrameCacheError(
      "CACHE_JSON_SHAPE_INVALID",
      "AlecaFrame cache did not contain a Warframe account object."
    );
  }

  return parsed;
}

export async function readAlecaFrameLastDataCache(): Promise<AlecaFrameCacheReadResult> {
  const dataDirectory = getAlecaFrameDataDirectory();
  const cachePath = getAlecaFrameLastDataPath();
  if (!cachePath) {
    throw new AlecaFrameCacheError(
      "LOCALAPPDATA_MISSING",
      "LOCALAPPDATA is not available to the server process. Start Void Ledger from a normal Windows user session.",
      { dataDirectory: null }
    );
  }

  let fileInfo: Awaited<ReturnType<typeof stat>>;
  let encryptedBytes: Buffer;
  let decryptedJson: string;

  try {
    fileInfo = await stat(cachePath);
  } catch (error) {
    throw new AlecaFrameCacheError(
      "CACHE_FILE_MISSING",
      `Void Ledger looked for AlecaFrame account data at ${cachePath}, but lastData.dat was not found.`,
      { cachePath, dataDirectory, cause: error }
    );
  }

  try {
    encryptedBytes = await readFile(cachePath);
  } catch (error) {
    throw new AlecaFrameCacheError(
      "CACHE_FILE_UNREADABLE",
      `Void Ledger found ${cachePath}, but Windows did not allow it to be read.`,
      { cachePath, dataDirectory, cause: error }
    );
  }

  try {
    decryptedJson = decryptAlecaFrameCache(encryptedBytes);
  } catch (error) {
    throw new AlecaFrameCacheError(
      "CACHE_DECRYPT_FAILED",
      `Void Ledger found ${cachePath}, but the AlecaFrame cache could not be decrypted.`,
      { cachePath, dataDirectory, cause: error }
    );
  }

  let rawInventory: unknown;

  try {
    rawInventory = parseInventoryJson(decryptedJson);
  } catch (error) {
    if (error instanceof AlecaFrameCacheError) {
      error.cachePath = error.cachePath ?? cachePath;
      error.dataDirectory = error.dataDirectory ?? dataDirectory;
    }
    throw error;
  }

  return {
    rawInventory,
    cacheFile: {
      path: cachePath,
      sizeBytes: fileInfo.size,
      lastModified: fileInfo.mtime.toISOString(),
    },
    decryptedBytes: Buffer.byteLength(decryptedJson, "utf8"),
  };
}

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { join } from "node:path";

const appUrl = process.env.VOID_LEDGER_URL ?? "http://127.0.0.1:3000";
const endpoint = new URL("/api/overwolf/inventory", appUrl);
const manifestPath = join(process.cwd(), "overwolf-bridge", "manifest.json");
const localAppData = process.env.LOCALAPPDATA;
const overwolfAppLogRoot = localAppData ? join(localAppData, "Overwolf", "Log", "Apps") : undefined;
const alecaFrameExtensionRoot = localAppData
  ? join(localAppData, "Overwolf", "Extensions", "afmcagbpgggkpdkokjhjkllpegnadmkignlonpjm")
  : undefined;
const alecaFrameLastDataPath = localAppData ? join(localAppData, "AlecaFrame", "lastData.dat") : undefined;
const alecaFrameCacheKey = Buffer.from([
  0x4c, 0x45, 0x4f, 0x2d, 0x41, 0x4c, 0x45, 0x43, 0x09, 0x45, 0x4f, 0x2d, 0x41, 0x4c, 0x45,
  0x43,
]);
const alecaFrameCacheIv = Buffer.from([
  0x31, 0x32, 0x46, 0x47, 0x42, 0x33, 0x36, 0x2d, 0x4c, 0x45, 0x33, 0x2d, 0x71, 0x3d, 0x39,
  0x00,
]);

function listLogFiles(root) {
  if (!root || !existsSync(root)) return [];

  const pending = [root];
  const files = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".log")) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
}

function findLatestLine(root, predicate) {
  let latest = null;

  for (const file of listLogFiles(root)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!predicate(line)) continue;

      const timestamp = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})/)?.[1];
      const parsedTime = timestamp ? Date.parse(timestamp.replace(",", ".")) : NaN;
      const sortTime = Number.isFinite(parsedTime) ? parsedTime : statSync(file).mtimeMs;

      if (!latest || sortTime > latest.sortTime) {
        latest = { file, line, timestamp, sortTime };
      }

      break;
    }
  }

  return latest;
}

function getAlecaFrameInventoryEvent() {
  const event = findLatestLine(
    overwolfAppLogRoot,
    (line) => line.includes("New inventory data")
  );

  if (!event) return null;

  const match = event.line.match(/New inventory data \((\d+) B\): (.*)$/);
  if (!match) return { ...event, declaredBytes: undefined, previewOnly: undefined };

  const declaredBytes = Number(match[1]);
  const preview = match[2] ?? "";

  return {
    ...event,
    declaredBytes,
    previewOnly: Number.isFinite(declaredBytes) && declaredBytes > preview.length,
  };
}

function isAlecaFrameForwarderPatched() {
  if (!alecaFrameExtensionRoot || !existsSync(alecaFrameExtensionRoot)) return false;

  const versionDirs = readdirSync(alecaFrameExtensionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  for (const version of versionDirs) {
    const backgroundPath = join(alecaFrameExtensionRoot, version, "web", "assets", "js", "background.js");
    if (!existsSync(backgroundPath)) continue;
    return readFileSync(backgroundPath, "utf8").includes("[VoidLedgerForward]");
  }

  return false;
}

function getAlecaFrameCacheStatus() {
  if (!alecaFrameLastDataPath || !existsSync(alecaFrameLastDataPath)) {
    return { exists: false, readable: false };
  }

  const fileInfo = statSync(alecaFrameLastDataPath);

  try {
    const decipher = createDecipheriv("aes-128-cbc", alecaFrameCacheKey, alecaFrameCacheIv);
    const decrypted = Buffer.concat([
      decipher.update(readFileSync(alecaFrameLastDataPath)),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(decrypted);

    return {
      exists: true,
      readable: Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed)),
      path: alecaFrameLastDataPath,
      sizeBytes: fileInfo.size,
      lastModified: fileInfo.mtime.toISOString(),
      decryptedBytes: Buffer.byteLength(decrypted, "utf8"),
    };
  } catch (error) {
    return {
      exists: true,
      readable: false,
      path: alecaFrameLastDataPath,
      sizeBytes: fileInfo.size,
      lastModified: fileInfo.mtime.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readJsonBody(response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Bridge API returned an empty response body with HTTP ${response.status}.`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const preview = text.slice(0, 500);
    throw new Error(
      `Bridge API returned invalid JSON with HTTP ${response.status}: ${error instanceof Error ? error.message : error}\n${preview}`
    );
  }
}

async function main() {
  console.log(`Void Ledger URL: ${appUrl}`);
  console.log(`Inventory endpoint: ${endpoint.toString()}`);
  console.log(`Overwolf manifest: ${manifestPath}`);
  console.log(`Manifest present: ${existsSync(manifestPath) ? "yes" : "no"}`);

  let response;
  try {
    response = await fetch(endpoint, { cache: "no-store" });
  } catch (error) {
    console.error("Bridge API unreachable. Start the app with `npm run dev` first.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  let body;
  try {
    body = await readJsonBody(response);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`Bridge API returned HTTP ${response.status}.`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log(`API reachable: yes`);
  console.log(`Snapshot present: ${body.hasSnapshot ? "yes" : "no"}`);

  if (body.hasSnapshot) {
    console.log(`Simulated: ${body.isSimulated ? "yes" : "no"}`);
    console.log(`Received: ${body.receivedAt}`);
    console.log(`Age: ${body.ageSeconds ?? "unknown"}s`);
    console.log(`Unique items: ${body.summary?.uniqueItemCount ?? 0}`);
    console.log(`Relics: ${body.summary?.relicCount ?? 0}`);
    console.log(`Prime parts: ${body.summary?.primePartCount ?? 0}`);
    console.log(`Mods: ${body.summary?.modCount ?? 0}`);
  } else {
    console.log(body.message ?? "No account inventory snapshot is saved in this local copy yet.");
  }

  const bridgeLog = findLatestLine(overwolfAppLogRoot, (line) => line.includes("[VoidLedgerBridge]"));
  console.log(`Void Ledger Overwolf app log: ${bridgeLog ? "seen" : "not found"}`);
  if (bridgeLog) {
    console.log(`Bridge log time: ${bridgeLog.timestamp ?? "unknown"}`);
    console.log(`Bridge log file: ${bridgeLog.file}`);
  }

  const alecaForwarderLog = findLatestLine(overwolfAppLogRoot, (line) => line.includes("[VoidLedgerForward]"));
  console.log(`AlecaFrame forwarder log: ${alecaForwarderLog ? "seen" : "not found"}`);
  if (alecaForwarderLog) {
    console.log(`AlecaFrame forwarder time: ${alecaForwarderLog.timestamp ?? "unknown"}`);
    console.log(`AlecaFrame forwarder file: ${alecaForwarderLog.file}`);
  }

  const alecaInventory = getAlecaFrameInventoryEvent();
  const alecaForwarderPatched = isAlecaFrameForwarderPatched();
  const alecaCache = getAlecaFrameCacheStatus();
  console.log(`AlecaFrame forwarder patch: ${alecaForwarderPatched ? "present" : "not found"}`);
  console.log(`AlecaFrame real inventory event: ${alecaInventory ? "seen" : "not found"}`);
  if (alecaInventory) {
    console.log(`AlecaFrame event time: ${alecaInventory.timestamp ?? "unknown"}`);
    if (alecaInventory.declaredBytes) {
      console.log(`AlecaFrame inventory payload size: ${alecaInventory.declaredBytes} B`);
    }
    console.log(`AlecaFrame log contains full payload: ${alecaInventory.previewOnly ? "no" : "unknown"}`);
  }
  console.log(`AlecaFrame cache file: ${alecaCache.exists ? "found" : "not found"}`);
  if (alecaCache.exists) {
    console.log(`AlecaFrame cache path: ${alecaCache.path}`);
    console.log(`AlecaFrame cache modified: ${alecaCache.lastModified ?? "unknown"}`);
    console.log(`AlecaFrame cache readable: ${alecaCache.readable ? "yes" : "no"}`);
    if (alecaCache.decryptedBytes) {
      console.log(`AlecaFrame decrypted JSON size: ${alecaCache.decryptedBytes} B`);
    }
    if (alecaCache.error) console.log(`AlecaFrame cache error: ${alecaCache.error}`);
  }

  if (!body.hasSnapshot && alecaCache.readable) {
    console.log("Next step: open Settings and click Import Cache, or POST /api/alecaframe/import.");
  } else if (!body.hasSnapshot && !bridgeLog && alecaInventory) {
    if (alecaForwarderPatched) {
      console.log("Next step: start Warframe, then open Inventory, Arsenal, Relics, or Mods to trigger a fresh AlecaFrame inventory event.");
    } else {
      console.log("Next step: load overwolf-bridge as an Overwolf unpacked extension, then click its dock icon.");
      console.log("If Overwolf shows 'Unauthorized App', log in to the Overwolf client and use an OW account whitelisted for unpacked development apps.");
    }
  }
}

main();

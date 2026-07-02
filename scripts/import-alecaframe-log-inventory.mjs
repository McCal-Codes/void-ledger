import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const appUrl = process.env.VOID_LEDGER_URL ?? "http://127.0.0.1:3000";
const endpoint = new URL("/api/overwolf/inventory", appUrl);
const localAppData = process.env.LOCALAPPDATA;

if (!localAppData) {
  console.error("LOCALAPPDATA is not set.");
  process.exit(1);
}

const alecaLogDir = join(localAppData, "Overwolf", "Log", "Apps", "AlecaFrame");
const inventoryMarker = "New inventory data";

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function listLogFiles() {
  const entries = await readdir(alecaLogDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !/^BackGround\.html.*\.log$/.test(entry.name)) continue;
    const fullPath = join(alecaLogDir, entry.name);
    const info = await stat(fullPath);
    files.push({ fullPath, mtimeMs: info.mtimeMs });
  }

  return files.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function extractTimestamp(line) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),(\d{3})/);
  if (!match) return undefined;
  return `${match[1]}.${match[2]}`;
}

function extractJsonPayload(line) {
  const markerIndex = line.indexOf(`${inventoryMarker} `);
  if (markerIndex < 0) return null;

  const jsonStart = line.indexOf("{", markerIndex);
  if (jsonStart < 0) return null;

  const jsonText = line.slice(jsonStart).trim();
  const parsed = JSON.parse(jsonText);

  if (parsed && typeof parsed === "object" && typeof parsed.InventoryJson === "string") {
    return JSON.parse(parsed.InventoryJson);
  }

  return parsed;
}

function getPayloadInfo(line) {
  const match = line.match(/New inventory data \((\d+) B\): (.*)$/);
  if (!match) return null;

  const declaredBytes = Number(match[1]);
  const previewText = match[2] ?? "";

  return {
    declaredBytes,
    previewBytes: Buffer.byteLength(previewText, "utf8"),
    previewOnly: Number.isFinite(declaredBytes) && declaredBytes > Buffer.byteLength(previewText, "utf8"),
  };
}

async function findLatestInventoryPayload() {
  const files = await listLogFiles();

  for (const file of files) {
    const contents = await readFile(file.fullPath, "utf8");
    const lines = contents.split(/\r?\n/);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!line.includes(inventoryMarker)) continue;

      return {
        file: file.fullPath,
        timestamp: extractTimestamp(line),
        payloadInfo: getPayloadInfo(line),
        line,
      };
    }
  }

  return null;
}

async function main() {
  const latest = await findLatestInventoryPayload();

  if (!latest) {
    console.error(`No AlecaFrame inventory log entry found in ${alecaLogDir}.`);
    process.exit(1);
  }

  if (latest.payloadInfo?.previewOnly) {
    console.error("AlecaFrame saw a real inventory payload, but its log only contains a short preview.");
    console.error(`Payload size: ${latest.payloadInfo.declaredBytes} B`);
    console.error(`Logged preview: ${latest.payloadInfo.previewBytes} B`);
    console.error("Cannot reconstruct your full account inventory from this log.");
    console.error("Load the Void Ledger Overwolf bridge as an unpacked extension to capture the full live payload.");
    process.exit(1);
  }

  const inventory = extractJsonPayload(latest.line);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "alecaframe-overwolf-log",
      eventType: "alecaframe-log-import",
      gameId: 8954,
      feature: "inventory",
      capturedAt: latest.timestamp,
      inventory,
    }),
  });

  const body = await readJson(response);

  if (!response.ok || !body.ok) {
    console.error("Failed to import AlecaFrame inventory log.");
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("Imported latest AlecaFrame inventory log into Void Ledger.");
  console.log(`Source log: ${latest.file}`);
  console.log(`Captured at: ${latest.timestamp ?? "unknown"}`);
  console.log(`Unique items: ${body.summary?.uniqueItemCount ?? 0}`);
  console.log(`Relics: ${body.summary?.relicCount ?? 0}`);
  console.log(`Prime parts: ${body.summary?.primePartCount ?? 0}`);
  console.log(`Mods: ${body.summary?.modCount ?? 0}`);
  console.log(`Resources: ${body.summary?.resourceCount ?? 0}`);
}

main().catch((error) => {
  console.error("AlecaFrame import failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

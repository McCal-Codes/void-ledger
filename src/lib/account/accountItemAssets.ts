import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AccountInventoryItem, AccountInventorySnapshot } from "@/types/account";
import type { BaroItem } from "@/types/baro";

type ItemAssetRecord = {
  uniqueName: string;
  name?: string;
  imageName?: string;
  imageUrl?: string;
  type?: string;
  category?: string;
  primeSellingPrice?: number;
  ducats?: number;
  tradable?: boolean;
};

const WARFRAME_CDN_BASE = "https://cdn.warframestat.us/img";
const GENERIC_COMPONENT_NAMES = new Set([
  "barrel",
  "blade",
  "blueprint",
  "boots",
  "brain",
  "carapace",
  "cerebrum",
  "chassis",
  "component",
  "gauntlet",
  "grip",
  "handle",
  "head",
  "harness",
  "hilt",
  "link",
  "neuroptics",
  "ornament",
  "pouch",
  "receiver",
  "stock",
  "string",
  "systems",
  "wings",
]);

let cachedCatalog: Promise<Map<string, ItemAssetRecord>> | null = null;

function getAlecaFrameJsonDirectory() {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData ? path.join(localAppData, "AlecaFrame", "cachedData", "json") : null;
}

function encodeImageName(imageName: string) {
  return imageName
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function warframeImageUrl(imageName?: string) {
  return imageName ? `${WARFRAME_CDN_BASE}/${encodeImageName(imageName)}` : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function assetQuality(asset: ItemAssetRecord) {
  let quality = 0;
  if (asset.name) quality += 1;
  if (asset.type) quality += 1;
  if (asset.category) quality += 1;
  if (asset.imageUrl) quality += 2;
  if (asset.imageName) quality += 3;
  if (asset.ducats || asset.primeSellingPrice) quality += 3;
  return quality;
}

function putAsset(catalog: Map<string, ItemAssetRecord>, candidate: ItemAssetRecord) {
  const existing = catalog.get(candidate.uniqueName);
  if (!existing || assetQuality(candidate) > assetQuality(existing)) {
    catalog.set(candidate.uniqueName, candidate);
  }
}

function collectAssetRecords(value: unknown, catalog: Map<string, ItemAssetRecord>, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const child of value) collectAssetRecords(child, catalog, depth + 1);
    return;
  }

  const record = getRecord(value);
  if (!record) return;

  const uniqueName = readString(record, "uniqueName");
  if (uniqueName) {
    const imageName = readString(record, "imageName");
    const imageUrl = warframeImageUrl(imageName) ?? readString(record, "wikiaThumbnail");

    putAsset(catalog, {
      uniqueName,
      name: readString(record, "name"),
      imageName,
      imageUrl,
      type: readString(record, "type"),
      category: readString(record, "category"),
      primeSellingPrice: readNumber(record, "primeSellingPrice"),
      ducats: readNumber(record, "ducats"),
      tradable: typeof record.tradable === "boolean" ? record.tradable : undefined,
    });
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === "object") collectAssetRecords(child, catalog, depth + 1);
  }
}

async function loadAlecaFrameAssetCatalog() {
  const catalog = new Map<string, ItemAssetRecord>();
  const directory = getAlecaFrameJsonDirectory();
  if (!directory) return catalog;

  let files: string[];
  try {
    files = await readdir(directory);
  } catch {
    return catalog;
  }

  await Promise.all(
    files
      .filter((file) => file.endsWith(".json") && file !== "lang.json" && file !== "Node.json")
      .map(async (file) => {
        try {
          const raw = await readFile(path.join(directory, file), "utf8");
          collectAssetRecords(JSON.parse(raw) as unknown, catalog);
        } catch {
          // Ignore malformed or temporarily locked cache files.
        }
      })
  );

  return catalog;
}

function getAssetCatalog() {
  cachedCatalog ??= loadAlecaFrameAssetCatalog();
  return cachedCatalog;
}

function isRawGeneratedName(name: string, itemType: string) {
  const compactName = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const lastTypeSegment = itemType.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "";

  return (
    name.startsWith("/Lotus/") ||
    compactName === lastTypeSegment ||
    compactName.startsWith("t1voidprojection") ||
    compactName.startsWith("t2voidprojection") ||
    compactName.startsWith("t3voidprojection") ||
    compactName.startsWith("t4voidprojection") ||
    compactName.startsWith("t5voidprojection") ||
    /^\d{4}resource/i.test(name)
  );
}

function shouldUseAssetName(item: AccountInventoryItem, asset: ItemAssetRecord) {
  if (!asset.name) return false;

  const normalizedAssetName = asset.name.trim().toLowerCase();
  if (!normalizedAssetName) return false;
  if (GENERIC_COMPONENT_NAMES.has(normalizedAssetName) && item.name.toLowerCase().includes(normalizedAssetName)) {
    return false;
  }

  return isRawGeneratedName(item.name, item.itemType) || !GENERIC_COMPONENT_NAMES.has(normalizedAssetName);
}

function normalizeAssetName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function findAssetByName(catalog: Map<string, ItemAssetRecord>, name: string) {
  const normalizedName = normalizeAssetName(name);

  for (const asset of catalog.values()) {
    if (asset.name && normalizeAssetName(asset.name) === normalizedName) return asset;
  }

  return undefined;
}

function getUniqueNameVariants(uniqueName: string) {
  const variants = new Set<string>([uniqueName]);
  const inventoryUniqueName = uniqueName.replace(/^\/Lotus\/StoreItems\//i, "/Lotus/");
  variants.add(inventoryUniqueName);

  for (const candidate of [...variants]) {
    if (/\/WarframeRecipes\//i.test(candidate)) {
      variants.add(candidate.replace(/HelmetBlueprint$/i, "HelmetComponent"));
      variants.add(candidate.replace(/NeuropticsBlueprint$/i, "HelmetComponent"));
      variants.add(candidate.replace(/ChassisBlueprint$/i, "ChassisComponent"));
      variants.add(candidate.replace(/SystemsBlueprint$/i, "SystemsComponent"));
      variants.add(candidate.replace(/Blueprint$/i, "Component"));
    }
  }

  return [...variants];
}

function findAsset(
  catalog: Map<string, ItemAssetRecord>,
  uniqueName: string | undefined,
  name: string
) {
  if (uniqueName) {
    for (const candidate of getUniqueNameVariants(uniqueName)) {
      const exact = catalog.get(candidate);
      if (exact) return exact;
    }
  }

  if (GENERIC_COMPONENT_NAMES.has(name.trim().toLowerCase())) return undefined;
  return findAssetByName(catalog, name);
}

function enrichItem(item: AccountInventoryItem, catalog: Map<string, ItemAssetRecord>): AccountInventoryItem {
  const asset = findAsset(catalog, item.itemType, item.name);
  if (!asset) return item;
  const ducatValue = asset.primeSellingPrice ?? asset.ducats ?? item.ducatValue;

  return {
    ...item,
    name: shouldUseAssetName(item, asset) ? asset.name ?? item.name : item.name,
    imageName: asset.imageName ?? item.imageName,
    imageUrl: asset.imageUrl ?? item.imageUrl,
    assetSource: asset.imageName ? "warframe-cdn" : asset.imageUrl ? "wiki" : item.assetSource,
    assetType: asset.type ?? item.assetType,
    ducatValue,
    valuationSource: ducatValue !== undefined ? "alecaframe-cache" : item.valuationSource,
  };
}

function enrichBaroItem(item: BaroItem, catalog: Map<string, ItemAssetRecord>): BaroItem {
  const asset = findAsset(catalog, item.internalName ?? (item.id.startsWith("/Lotus/") ? item.id : undefined), item.name);
  if (!asset) return item;

  return {
    ...item,
    internalName: item.internalName ?? asset.uniqueName,
    imageName: asset.imageName ?? item.imageName,
    imageUrl: asset.imageUrl ?? item.imageUrl,
    assetSource: asset.imageName ? "warframe-cdn" : asset.imageUrl ? "wiki" : item.assetSource,
    assetType: asset.type ?? item.assetType,
  };
}

export async function enrichAccountInventorySnapshot(
  snapshot: AccountInventorySnapshot
): Promise<AccountInventorySnapshot> {
  const catalog = await getAssetCatalog();
  if (catalog.size === 0) return snapshot;

  return {
    ...snapshot,
    items: snapshot.items.map((item) => enrichItem(item, catalog)),
  };
}

export async function enrichBaroItemsWithAssets(items: BaroItem[]): Promise<BaroItem[]> {
  const catalog = await getAssetCatalog();
  if (catalog.size === 0) return items;

  return items.map((item) => enrichBaroItem(item, catalog));
}

import type {
  AccountInventoryItem,
  AccountInventoryResources,
  AccountInventorySnapshot,
  AccountInventorySummary,
} from "@/types/account";

type SnapshotInput = {
  source: string;
  receivedAt: string;
  gameId?: number;
  feature?: string;
  eventType?: string;
  rawInventory: unknown;
};

type ParseResult = {
  value: unknown;
  parsed: boolean;
};

const IDENTITY_KEYS = [
  "ItemType",
  "itemType",
  "item_type",
  "internalName",
  "uniqueID",
  "uniqueId",
  "UniqueName",
  "uniqueName",
  "Type",
  "type",
  "Name",
  "name",
];

const ITEM_TYPE_KEYS = [
  "ItemType",
  "itemType",
  "item_type",
  "internalName",
  "uniqueID",
  "uniqueId",
  "UniqueName",
  "uniqueName",
  "Type",
  "type",
];
const NAME_KEYS = ["Name", "name", "ItemName", "itemName", "LocalizedName", "localizedName", "DisplayName", "displayName"];
const QUANTITY_KEYS = [
  "ItemCount",
  "itemCount",
  "amountOwned",
  "ownedAmount",
  "ownedCount",
  "countOwned",
  "Count",
  "count",
  "Quantity",
  "quantity",
  "Amount",
  "amount",
  "Qty",
  "qty",
];
const NON_INVENTORY_BRANCHES = [
  "$.Affiliations",
  "$.CalendarProgress",
  "$.ChallengeProgress",
  "$.CompletedJobs",
  "$.CurrentLoadOutIds",
  "$.DiscoveredMarkers",
  "$.EndlessXP",
  "$.LoadOutPresets",
  "$.LoreFragmentScans",
  "$.Missions",
  "$.NodeIntrosCompleted",
  "$.PendingTrades",
  "$.PrimeAccess",
  "$.QuestKeys",
  "$.RecentVendorPurchases",
  "$.SeasonChallengeHistory",
  "$.Settings",
  "$.TauntHistory",
  "$.Upgrades",
  "$.WebFlags",
  "$.Wishlist",
  "$.XPInfo",
];
const CATEGORY_ORDER: Record<AccountInventoryItem["category"], number> = {
  Relic: 0,
  "Prime Part": 1,
  Mod: 2,
  Resource: 3,
  Warframe: 4,
  Weapon: 5,
  Cosmetic: 6,
  Other: 7,
};

function parseMaybeJson(rawInventory: unknown): ParseResult {
  let value = rawInventory;
  let parsed = false;

  for (let index = 0; index < 3; index += 1) {
    if (typeof value !== "string") break;

    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) break;

    try {
      value = JSON.parse(trimmed) as unknown;
      parsed = true;
    } catch {
      break;
    }
  }

  return { value, parsed };
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringFromKeys(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

function numberFromKeys(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function compactHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function normalizeName(value: string) {
  return value
    .replace(/^\/Lotus\//i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function prettifyItemType(itemType: string) {
  const lastSegment = itemType.split("/").filter(Boolean).at(-1) ?? itemType;
  return lastSegment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categorizeItem(name: string, itemType: string): AccountInventoryItem["category"] {
  const text = `${name} ${itemType}`.toLowerCase();

  if (
    text.includes("cosmetic") ||
    text.includes("skin") ||
    text.includes("syandana") ||
    text.includes("customization") ||
    text.includes("deco") ||
    text.includes("avatarimage") ||
    text.includes("colourpicker")
  ) {
    return "Cosmetic";
  }

  if (
    text.includes("/projections/") ||
    text.includes("voidprojection") ||
    text.includes("void projection") ||
    /(^|[\s/_-])relics?($|[\s/_-])/.test(text)
  ) {
    return "Relic";
  }

  if (
    text.includes("prime") &&
    (text.includes("blueprint") ||
      text.includes("systems") ||
      text.includes("chassis") ||
      text.includes("neuroptics") ||
      text.includes("receiver") ||
      text.includes("barrel") ||
      text.includes("stock") ||
      text.includes("blade") ||
      text.includes("handle") ||
      text.includes("string") ||
      text.includes("grip") ||
      text.includes("link") ||
      text.includes("pouch") ||
      text.includes("part"))
  ) {
    return "Prime Part";
  }

  if (text.includes("upgrade") || text.includes("mod")) return "Mod";

  if (
    text.includes("resource") ||
    text.includes("miscitem") ||
    text.includes("ingredient") ||
    text.includes("ducat") ||
    text.includes("credits")
  ) {
    return "Resource";
  }

  if (text.includes("warframe") || text.includes("/suits/") || text.includes("space suit")) {
    return "Warframe";
  }

  if (
    text.includes("weapon") ||
    text.includes("rifle") ||
    text.includes("shotgun") ||
    text.includes("pistol") ||
    text.includes("melee") ||
    text.includes("archwing")
  ) {
    return "Weapon";
  }

  return "Other";
}

function hasIdentity(record: Record<string, unknown>) {
  return IDENTITY_KEYS.some((key) => typeof record[key] === "string" && String(record[key]).trim());
}

function readInventoryItem(record: Record<string, unknown>, rawPath: string): AccountInventoryItem | null {
  if (!hasIdentity(record)) return null;

  const itemType = stringFromKeys(record, ITEM_TYPE_KEYS);
  const explicitName = stringFromKeys(record, NAME_KEYS);
  const explicitQuantity = numberFromKeys(record, QUANTITY_KEYS);

  if (!itemType && !explicitName) return null;
  if (!itemType && explicitQuantity === undefined && record.owned !== true) return null;

  const name = explicitName ?? prettifyItemType(itemType ?? "");
  const normalizedName = normalizeName(name);

  if (!normalizedName) return null;

  if (record.owned === false) return null;
  if (explicitQuantity !== undefined && explicitQuantity <= 0) return null;

  const quantity = Math.max(1, Math.floor(explicitQuantity ?? 1));
  const resolvedItemType = itemType ?? name;
  const category = categorizeItem(name, resolvedItemType);
  const idBase = `${category}:${normalizeName(resolvedItemType)}:${normalizedName}`;

  return {
    id: `overwolf-${compactHash(idBase)}`,
    name,
    itemType: resolvedItemType,
    category,
    quantity,
    rawPath,
  };
}

function mergeItem(items: Map<string, AccountInventoryItem>, item: AccountInventoryItem) {
  const key = `${item.category}:${normalizeName(item.itemType)}:${normalizeName(item.name)}`;
  const existing = items.get(key);

  if (!existing) {
    items.set(key, item);
    return;
  }

  existing.quantity += item.quantity;
}

function assignCurrency(
  resources: AccountInventoryResources,
  key: string,
  value: unknown,
  currentPath: string
) {
  const numericValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numericValue)) return;

  const normalizedKey = key.toLowerCase();
  const normalizedPath = currentPath.toLowerCase();

  if (normalizedKey === "regularcredits" || normalizedKey === "credits") {
    resources.credits = numericValue;
    return;
  }

  if (normalizedKey === "premiumcredits" || normalizedKey === "platinum") {
    resources.platinum = numericValue;
    return;
  }

  if (
    normalizedKey === "freepremiumcredits" ||
    normalizedKey === "premiumcreditsfree" ||
    normalizedKey === "freeplatinum"
  ) {
    resources.freePlatinum = numericValue;
    return;
  }

  if (normalizedKey === "fusionpoints" || normalizedKey === "endo") {
    resources.endo = numericValue;
    return;
  }

  if (normalizedKey.includes("ducat") || normalizedPath.includes("orokinducats")) {
    resources.ducats = numericValue;
  }
}

function shouldSkipInventoryBranch(rawPath: string) {
  return NON_INVENTORY_BRANCHES.some(
    (branch) => rawPath === branch || rawPath.startsWith(`${branch}.`) || rawPath.startsWith(`${branch}[`)
  );
}

function walkInventory(
  value: unknown,
  rawPath: string,
  items: Map<string, AccountInventoryItem>,
  resources: AccountInventoryResources,
  depth = 0
) {
  if (depth > 12 || value === null || value === undefined) return;
  if (shouldSkipInventoryBranch(rawPath)) return;

  if (typeof value === "string") {
    const parsedValue = parseMaybeJson(value);
    if (parsedValue.parsed) {
      walkInventory(parsedValue.value, rawPath, items, resources, depth + 1);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      walkInventory(child, `${rawPath}[${index}]`, items, resources, depth + 1)
    );
    return;
  }

  const record = getRecord(value);
  if (!record) return;

  const parsedItem = readInventoryItem(record, rawPath);
  if (parsedItem) {
    mergeItem(items, parsedItem);

    if (parsedItem.category === "Resource") {
      const resourcePath = `${rawPath}.${parsedItem.itemType}`;
      assignCurrency(resources, parsedItem.name, parsedItem.quantity, resourcePath);
      assignCurrency(resources, parsedItem.itemType, parsedItem.quantity, resourcePath);
    }
  }

  for (const [key, child] of Object.entries(record)) {
    assignCurrency(resources, key, child, `${rawPath}.${key}`);
    walkInventory(child, `${rawPath}.${key}`, items, resources, depth + 1);
  }
}

function summarizeInventory(value: unknown, parsed: boolean, items: AccountInventoryItem[]): AccountInventorySummary {
  const rawType = Array.isArray(value) ? "array" : typeof value;

  return {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    rawType,
    parsed,
    relicCount: items.filter((item) => item.category === "Relic").length,
    primePartCount: items.filter((item) => item.category === "Prime Part").length,
    modCount: items.filter((item) => item.category === "Mod").length,
    resourceCount: items.filter((item) => item.category === "Resource").length,
    uniqueItemCount: items.length,
  };
}

export function parseOverwolfInventoryPayload(rawInventory: unknown) {
  const parsedInventory = parseMaybeJson(rawInventory);
  const items = new Map<string, AccountInventoryItem>();
  const resources: AccountInventoryResources = {};

  walkInventory(parsedInventory.value, "$", items, resources);

  const sortedItems = [...items.values()].sort((left, right) => {
    if (left.category !== right.category) {
      return CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category];
    }
    return left.name.localeCompare(right.name);
  });

  return {
    value: parsedInventory.value,
    parsed: parsedInventory.parsed,
    items: sortedItems,
    resources,
    summary: summarizeInventory(parsedInventory.value, parsedInventory.parsed, sortedItems),
  };
}

export function buildAccountInventorySnapshot(input: SnapshotInput): AccountInventorySnapshot {
  const parsedInventory = parseOverwolfInventoryPayload(input.rawInventory);

  return {
    source: input.source,
    receivedAt: input.receivedAt,
    gameId: input.gameId,
    feature: input.feature,
    eventType: input.eventType,
    rawInventory: input.rawInventory,
    summary: parsedInventory.summary,
    items: parsedInventory.items,
    resources: parsedInventory.resources,
  };
}

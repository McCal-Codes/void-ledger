import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AccountInventoryItem } from "@/types/account";

export type PrimeSetProtection = {
  setName: string;
  setType?: string;
  ownedSet: boolean;
  canCraft: boolean;
  requiredQuantity: number;
  ownedQuantity: number;
  protectedQuantity: number;
  missingSetParts: string[];
  reason: string;
};

export type PrimeComponentMetadata = {
  displayName: string;
  setName: string;
  setType?: string;
  requiredQuantity: number;
  ducatValue: number;
};

type PrimeSetComponent = {
  uniqueName: string;
  displayName: string;
  requiredQuantity: number;
  ducatValue: number;
};

type PrimeCraftSet = {
  uniqueName: string;
  name: string;
  type?: string;
  category?: string;
  components: PrimeSetComponent[];
};

const PRIME_SET_TYPES = new Set([
  "Arch-Gun",
  "Arch-Melee",
  "Archwing",
  "Companion",
  "Melee",
  "Primary",
  "Secondary",
  "Sentinel",
  "Warframe",
]);

let cachedPrimeSets: Promise<PrimeCraftSet[]> | null = null;

function getAlecaFrameJsonDirectory() {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData ? path.join(localAppData, "AlecaFrame", "cachedData", "json") : null;
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

function normalizeKey(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function displayComponentName(setName: string, component: Record<string, unknown>) {
  const drops = Array.isArray(component.drops) ? component.drops : [];
  for (const drop of drops) {
    const dropRecord = getRecord(drop);
    const type = dropRecord ? readString(dropRecord, "type") : undefined;
    if (type?.includes("Prime")) return type.replace(/\s+Helmet\s+Blueprint$/i, " Neuroptics Blueprint");
  }

  const componentName = readString(component, "name") ?? "Part";
  if (componentName === "Blueprint") return `${setName} Blueprint`;
  if (componentName === "Helmet") return `${setName} Neuroptics Blueprint`;
  if (["Chassis", "Neuroptics", "Systems"].includes(componentName)) {
    return `${setName} ${componentName} Blueprint`;
  }
  return `${setName} ${componentName}`;
}

function uniqueNameVariants(uniqueName: string) {
  const variants = new Set<string>([uniqueName]);
  const storeless = uniqueName.replace(/^\/Lotus\/StoreItems\//i, "/Lotus/");
  variants.add(storeless);

  for (const candidate of [...variants]) {
    if (/\/WarframeRecipes\//i.test(candidate)) {
      variants.add(candidate.replace(/HelmetBlueprint$/i, "HelmetComponent"));
      variants.add(candidate.replace(/NeuropticsBlueprint$/i, "HelmetComponent"));
      variants.add(candidate.replace(/ChassisBlueprint$/i, "ChassisComponent"));
      variants.add(candidate.replace(/SystemsBlueprint$/i, "SystemsComponent"));
      variants.add(candidate.replace(/HelmetComponent$/i, "HelmetBlueprint"));
      variants.add(candidate.replace(/ChassisComponent$/i, "ChassisBlueprint"));
      variants.add(candidate.replace(/SystemsComponent$/i, "SystemsBlueprint"));
      variants.add(candidate.replace(/Component$/i, "Blueprint"));
    }
  }

  return [...variants];
}

function looksLikePrimeSet(record: Record<string, unknown>) {
  const name = readString(record, "name") ?? "";
  const uniqueName = readString(record, "uniqueName");
  const components = record.components;
  const isPrime = record.isPrime === true || name.includes("Prime");
  const type = readString(record, "type");
  const category = readString(record, "category");
  const isCraftableCategory =
    (type ? PRIME_SET_TYPES.has(type) : false) ||
    (category ? PRIME_SET_TYPES.has(category) || category === "Warframes" : false);

  return Boolean(
    uniqueName &&
      isPrime &&
      name.includes("Prime") &&
      Array.isArray(components) &&
      components.length > 0 &&
      isCraftableCategory &&
      category !== "Relics"
  );
}

function collectPrimeSets(value: unknown, sets: PrimeCraftSet[], depth = 0) {
  if (depth > 7 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const child of value) collectPrimeSets(child, sets, depth + 1);
    return;
  }

  const record = getRecord(value);
  if (!record) return;

  if (looksLikePrimeSet(record)) {
    const name = readString(record, "name")!;
    const components = (record.components as unknown[])
      .map((componentValue) => {
        const component = getRecord(componentValue);
        if (!component) return null;

        const uniqueName = readString(component, "uniqueName");
        const ducatValue = readNumber(component, "primeSellingPrice") ?? readNumber(component, "ducats") ?? 0;
        const tradable = component.tradable === true;

        if (!uniqueName || !tradable || ducatValue <= 0) return null;

        return {
          uniqueName,
          displayName: displayComponentName(name, component),
          requiredQuantity: Math.max(1, Math.floor(readNumber(component, "itemCount") ?? 1)),
          ducatValue,
        } satisfies PrimeSetComponent;
      })
      .filter((component): component is PrimeSetComponent => Boolean(component));

    if (components.length > 0) {
      sets.push({
        uniqueName: readString(record, "uniqueName")!,
        name,
        type: readString(record, "type"),
        category: readString(record, "category"),
        components,
      });
    }
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === "object") collectPrimeSets(child, sets, depth + 1);
  }
}

async function loadPrimeSets() {
  const directory = getAlecaFrameJsonDirectory();
  if (!directory) return [];

  let files: string[];
  try {
    files = await readdir(directory);
  } catch {
    return [];
  }

  const sets: PrimeCraftSet[] = [];
  await Promise.all(
    files
      .filter((file) => file.endsWith(".json") && file !== "lang.json" && file !== "Node.json")
      .map(async (file) => {
        try {
          collectPrimeSets(JSON.parse(await readFile(path.join(directory, file), "utf8")) as unknown, sets);
        } catch {
          // Ignore stale or malformed AlecaFrame cache files.
        }
      })
  );

  const deduped = new Map<string, PrimeCraftSet>();
  for (const set of sets) {
    const existing = deduped.get(set.uniqueName);
    if (!existing || set.components.length > existing.components.length) {
      deduped.set(set.uniqueName, set);
    }
  }
  return [...deduped.values()];
}

function getPrimeSets() {
  cachedPrimeSets ??= loadPrimeSets();
  return cachedPrimeSets;
}

function buildInventoryIndexes(items: AccountInventoryItem[]) {
  const quantityByUnique = new Map<string, number>();
  const quantityByName = new Map<string, number>();
  const ownedSetNames = new Set<string>();
  const ownedSetUniqueNames = new Set<string>();

  for (const item of items) {
    for (const variant of uniqueNameVariants(item.itemType)) {
      const key = normalizeKey(variant);
      quantityByUnique.set(key, (quantityByUnique.get(key) ?? 0) + item.quantity);
    }

    const nameKey = normalizeKey(item.name);
    quantityByName.set(nameKey, (quantityByName.get(nameKey) ?? 0) + item.quantity);

    if ((item.category === "Weapon" || item.category === "Warframe") && item.name.includes("Prime")) {
      ownedSetNames.add(nameKey);
      ownedSetUniqueNames.add(normalizeKey(item.itemType));
    }
  }

  return { quantityByUnique, quantityByName, ownedSetNames, ownedSetUniqueNames };
}

function componentOwnedQuantity(
  component: PrimeSetComponent,
  indexes: ReturnType<typeof buildInventoryIndexes>
) {
  const byUnique = uniqueNameVariants(component.uniqueName).reduce(
    (quantity, variant) => Math.max(quantity, indexes.quantityByUnique.get(normalizeKey(variant)) ?? 0),
    0
  );
  const byName = indexes.quantityByName.get(normalizeKey(component.displayName)) ?? 0;
  return Math.max(byUnique, byName);
}

function buildComponentIndex(sets: PrimeCraftSet[]) {
  const componentIndex = new Map<string, PrimeCraftSet[]>();

  for (const set of sets) {
    for (const component of set.components) {
      const keys = [
        ...uniqueNameVariants(component.uniqueName).map(normalizeKey),
        normalizeKey(component.displayName),
      ];

      for (const key of keys) {
        const existing = componentIndex.get(key) ?? [];
        existing.push(set);
        componentIndex.set(key, existing);
      }
    }
  }

  return componentIndex;
}

function getItemLookupKeys(item: AccountInventoryItem) {
  return [
    ...uniqueNameVariants(item.itemType).map(normalizeKey),
    normalizeKey(item.name),
  ];
}

function findMatchingComponent(set: PrimeCraftSet, lookupKeys: string[]) {
  return set.components.find((component) => {
    const componentKeys = [
      ...uniqueNameVariants(component.uniqueName).map(normalizeKey),
      normalizeKey(component.displayName),
    ];
    return lookupKeys.some((key) => componentKeys.includes(key));
  });
}

export async function getPrimeComponentMetadata(items: AccountInventoryItem[]) {
  const sets = await getPrimeSets();
  const componentIndex = buildComponentIndex(sets);
  const metadata: Record<string, PrimeComponentMetadata> = {};

  for (const item of items) {
    if (item.category !== "Prime Part" || item.quantity <= 0) continue;

    const lookupKeys = getItemLookupKeys(item);
    const candidateSets = lookupKeys.flatMap((key) => componentIndex.get(key) ?? []);
    const uniqueCandidateSets = [...new Map(candidateSets.map((set) => [set.uniqueName, set])).values()];

    for (const set of uniqueCandidateSets) {
      const matchingComponent = findMatchingComponent(set, lookupKeys);
      if (!matchingComponent) continue;

      metadata[item.id] = {
        displayName: matchingComponent.displayName,
        setName: set.name,
        setType: set.type,
        requiredQuantity: matchingComponent.requiredQuantity,
        ducatValue: matchingComponent.ducatValue,
      };
      break;
    }
  }

  return metadata;
}

export async function getPrimeSetProtections(items: AccountInventoryItem[]) {
  const sets = await getPrimeSets();
  const indexes = buildInventoryIndexes(items);
  const componentIndex = buildComponentIndex(sets);

  const protections: Record<string, PrimeSetProtection> = {};

  for (const item of items) {
    if (item.category !== "Prime Part" || item.quantity <= 0) continue;

    const lookupKeys = getItemLookupKeys(item);
    const candidateSets = lookupKeys.flatMap((key) => componentIndex.get(key) ?? []);
    const uniqueCandidateSets = [...new Map(candidateSets.map((set) => [set.uniqueName, set])).values()];

    let bestProtection: PrimeSetProtection | null = null;

    for (const set of uniqueCandidateSets) {
      const ownedSet =
        indexes.ownedSetNames.has(normalizeKey(set.name)) ||
        indexes.ownedSetUniqueNames.has(normalizeKey(set.uniqueName));
      if (ownedSet) continue;

      const matchingComponent = findMatchingComponent(set, lookupKeys);
      if (!matchingComponent) continue;

      const missingSetParts = set.components
        .filter((component) => componentOwnedQuantity(component, indexes) < component.requiredQuantity)
        .map((component) => component.displayName);
      const canCraft = missingSetParts.length === 0;
      const ownedQuantity = componentOwnedQuantity(matchingComponent, indexes);
      const protectedQuantity = Math.min(item.quantity, matchingComponent.requiredQuantity);

      const protection: PrimeSetProtection = {
        setName: set.name,
        setType: set.type,
        ownedSet,
        canCraft,
        requiredQuantity: matchingComponent.requiredQuantity,
        ownedQuantity,
        protectedQuantity,
        missingSetParts,
        reason: canCraft
          ? `Completes ${set.name}.`
          : `Needed for ${set.name}; missing ${missingSetParts.slice(0, 3).join(", ")}${
              missingSetParts.length > 3 ? ` +${missingSetParts.length - 3} more` : ""
            }.`,
      };

      if (
        !bestProtection ||
        Number(protection.canCraft) > Number(bestProtection.canCraft) ||
        protection.missingSetParts.length < bestProtection.missingSetParts.length
      ) {
        bestProtection = protection;
      }
    }

    if (bestProtection) {
      protections[item.id] = bestProtection;
    }
  }

  return protections;
}

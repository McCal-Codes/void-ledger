import { readJsonResponse } from "@/lib/http/json";
import { BaroItem } from "@/types/baro";

const API_BASE = "/api"; // Use Next.js API routes to avoid CORS

export async function fetchBaroInventory({ cache }: { cache?: RequestCache } = {}): Promise<BaroItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_BASE}/baro`, {
      signal: controller.signal,
      cache,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch Baro inventory: ${response.statusText}`);
    }

    const data = await readJsonResponse<unknown>(response, {
      emptyMessage: "Baro inventory response was empty.",
      invalidMessage: "Baro inventory response was not valid JSON.",
    });
    
    // Warframe.stat.us voidTrader endpoint returns object with inventory array
    const responseBody = asRecord(data);
    const inventory = Array.isArray(responseBody.inventory) ? responseBody.inventory : [];
    
    return inventory.map(transformBaroItem);
  } catch (error) {
    const errorMessage = error instanceof Error && error.name === 'AbortError'
      ? 'Request timeout'
      : 'Failed to fetch Baro inventory';
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}

export async function fetchRelicPrices(): Promise<Record<string, number>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_BASE}/relic-prices`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch relic prices: ${response.statusText}`);
    }

    const data = await readJsonResponse<unknown>(response, {
      emptyMessage: "Relic prices response was empty.",
      invalidMessage: "Relic prices response was not valid JSON.",
    });
    
    // Validate response is an array
    if (!Array.isArray(data)) {
      console.error("Invalid relic prices response: expected array");
      return {};
    }
    
    const priceRecord: Record<string, number> = {};
    data.forEach((relic: unknown) => {
      const relicObj = asRecord(relic);
      if (typeof relicObj.relicName === "string" && typeof relicObj.price === 'number') {
        priceRecord[relicObj.relicName] = relicObj.price;
      }
    });
    
    return priceRecord;
  } catch (error) {
    const errorMessage = error instanceof Error && error.name === 'AbortError'
      ? 'Request timeout'
      : 'Failed to fetch relic prices';
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}

function transformBaroItem(rawItem: unknown): BaroItem {
  const item = asRecord(rawItem);
  const name = readString(item.item ?? item.name, "Unknown Item");
  const ducatCost = readNumber(item.ducats);
  const creditCost = readNumber(item.credits);

  return {
    id: readString(item.id ?? item._id, name),
    name,
    category: normalizeCategory(item.category, name),
    ducatCost,
    creditCost,
    tradable: readBoolean(item.tradable, true),
    owned: false,
    recommendedPriority: getRecommendedPriority(name, ducatCost),
    notes: "",
    source: "official",
    lastUpdated: new Date(),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeCategory(value: unknown, name: string): BaroItem["category"] {
  const rawCategory = readString(value, "");
  const normalized = `${rawCategory} ${name}`.toLowerCase();

  if (normalized.includes("primed") && normalized.includes("mod")) return "Primed Mod";
  if (normalized.includes("weapon")) return "Weapon";
  if (normalized.includes("decoration")) return "Decoration";
  if (normalized.includes("cosmetic") || normalized.includes("skin") || normalized.includes("armor")) return "Cosmetic";
  if (normalized.includes("mod")) return "Mod";
  return "Other";
}

function getRecommendedPriority(name: string, ducatCost: number): BaroItem["recommendedPriority"] {
  if (name.startsWith("Primed ")) return "High";
  if (ducatCost >= 400) return "Medium";
  return "Low";
}

import { readJsonResponse } from "@/lib/http/json";
import { Fissure } from "@/types/fissure";

const API_BASE = "/api"; // Use Next.js API routes to avoid CORS
const MINUTE_MS = 60 * 1000;

export async function fetchFissures({ cache }: { cache?: RequestCache } = {}): Promise<Fissure[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_BASE}/fissures`, {
      signal: controller.signal,
      cache,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch fissures: ${response.statusText}`);
    }

    const data = await readJsonResponse<unknown>(response, {
      emptyMessage: "Fissures response was empty.",
      invalidMessage: "Fissures response was not valid JSON.",
    });
    if (!Array.isArray(data)) {
      throw new Error("Invalid fissures response: expected an array");
    }
    
    return data.map(transformFissure).filter((fissure) => fissure.minutesRemaining > 0);
  } catch (error) {
    const errorMessage = error instanceof Error && error.name === 'AbortError'
      ? 'Request timeout'
      : 'Failed to fetch fissures';
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}

function transformFissure(rawFissure: unknown): Fissure {
  const fissure = asRecord(rawFissure);
  const missionType = readString(fissure.missionType, "Unknown");
  const start = readDate(fissure.activation ?? fissure.start);
  const end = readDate(fissure.expiry ?? fissure.end);
  const minutesRemaining = Math.max(0, Math.ceil((end.getTime() - Date.now()) / MINUTE_MS));

  return {
    id: readString(fissure.id ?? fissure._id, `${missionType}-${readString(fissure.node, "Unknown")}`),
    tier: readString(fissure.tier, "Unknown"),
    missionType,
    node: readString(fissure.node, "Unknown"),
    faction: readString(fissure.faction ?? fissure.enemy, "Unknown"),
    start,
    end,
    minutesRemaining,
    speedScore: calculateSpeedScore(missionType),
    recommended: isRecommended(missionType),
    isHard: readBoolean(fissure.isHard),
    notes: readBoolean(fissure.isHard) ? "Steel Path" : undefined,
  };
}

function calculateSpeedScore(missionType: string): number {
  const weights: Record<string, number> = {
    Capture: 1.0,
    Rescue: 0.95,
    Exterminate: 0.85,
    Sabotage: 0.75,
    "Mobile Defense": 0.55,
    Defense: 0.35,
    Interception: 0.25,
    Survival: 0.20,
  };
  return weights[missionType] || 0.1;
}

function isRecommended(missionType: string): boolean {
  return calculateSpeedScore(missionType) >= 0.75;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readDate(value: unknown): Date {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    console.warn("Invalid date value type:", typeof value);
    return new Date();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    console.warn("Invalid date value:", value);
    return new Date();
  }
  return date;
}

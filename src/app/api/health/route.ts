import { NextRequest, NextResponse } from "next/server";
import { getOverwolfInventoryStatus } from "@/lib/account/overwolfSnapshotStatus";
import { readAlecaFrameLastDataCache } from "@/lib/account/alecaframeCache";
import { getPrimePartMarketCacheHealth } from "@/lib/api/warframeMarket";
import { getPrimePartAnalysis } from "@/lib/inventory/primePartAnalysis";
import type { DataHealthResponse, HealthCheck, HealthCheckStatus } from "@/types/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCOUNT_HEALTH_MS = 24 * 60 * 60 * 1000;
const WORLD_HEALTH_MS = 5 * 60 * 1000;
const WORLD_STALE_MS = 10 * 60 * 1000;
const BARO_HEALTH_MS = 30 * 60 * 1000;
const SHEET_HEALTH_MS = 24 * 60 * 60 * 1000;
const MARKET_HEALTH_MS = 24 * 60 * 60 * 1000;

type FetchResult<T> = {
  ok: boolean;
  data?: T;
  checkedAt: string;
  error?: string;
  status?: number;
};

function ageSecondsFrom(value?: string) {
  if (!value) return null;
  const updatedMs = new Date(value).getTime();
  if (!Number.isFinite(updatedMs)) return null;
  return Math.max(0, Math.round((Date.now() - updatedMs) / 1000));
}

function timedStatus(
  value: string | undefined,
  healthyMs: number,
  staleMs = healthyMs
): HealthCheckStatus {
  const updatedMs = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(updatedMs)) return "waiting";
  const ageMs = Date.now() - updatedMs;
  if (ageMs <= healthyMs) return "healthy";
  if (ageMs <= staleMs) return "degraded";
  return "stale";
}

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<FetchResult<T>> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let data: T | undefined;

    if (text.trim()) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        return {
          ok: false,
          checkedAt,
          status: response.status,
          error: `Invalid JSON response from ${url}`,
        };
      }
    }

    if (data === undefined) {
      return {
        ok: false,
        checkedAt,
        status: response.status,
        error: `Empty response from ${url}`,
      };
    }

    return response.ok
      ? { ok: true, data, checkedAt, status: response.status }
      : {
          ok: false,
          data,
          checkedAt,
          status: response.status,
          error: `HTTP ${response.status} ${response.statusText}`,
        };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "Request timed out"
          : error instanceof Error
            ? error.message
            : "Request failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildOverall(checks: DataHealthResponse["checks"]): DataHealthResponse["overall"] {
  const statuses = Object.values(checks).map((check) => check.status);
  if (statuses.includes("error")) return "error";
  if (statuses.includes("stale")) return "stale";
  if (
    statuses.some((status) =>
      ["degraded", "waiting", "ignored"].includes(status)
    )
  ) {
    return "degraded";
  }
  return "healthy";
}

async function accountInventoryCheck(): Promise<HealthCheck> {
  const status = await getOverwolfInventoryStatus({ limit: 0 });

  if (status.isSimulated) {
    return {
      status: "ignored",
      label: "Account Inventory",
      lastUpdated: status.receivedAt,
      ageSeconds: status.ageSeconds,
      summary: { file: status.file?.path },
      message: status.message ?? "Simulator dry-run snapshot is ignored.",
    };
  }

  if (!status.hasSnapshot) {
    return {
      status: "waiting",
      label: "Account Inventory",
      message:
        status.message ??
        "No account inventory snapshot is available. Import AlecaFrame or restore a JSON backup.",
    };
  }

  const healthStatus = timedStatus(status.receivedAt, ACCOUNT_HEALTH_MS);

  return {
    status: healthStatus,
    label: "Account Inventory",
    lastUpdated: status.receivedAt,
    ageSeconds: status.ageSeconds,
    summary: {
      source: status.source,
      uniqueItems: status.summary?.uniqueItemCount,
      relics: status.summary?.relicCount,
      primeParts: status.summary?.primePartCount,
      credits: status.resources?.credits,
      platinum: status.resources?.platinum,
    },
    message:
      healthStatus === "healthy"
        ? "Real account snapshot is current."
        : "Account snapshot is stale. Import AlecaFrame again or restore a newer JSON backup.",
  };
}

async function alecaframeCacheCheck(): Promise<HealthCheck> {
  try {
    const cache = await readAlecaFrameLastDataCache();
    const status = timedStatus(cache.cacheFile.lastModified, ACCOUNT_HEALTH_MS);

    return {
      status,
      label: "AlecaFrame Cache",
      lastUpdated: cache.cacheFile.lastModified,
      ageSeconds: ageSecondsFrom(cache.cacheFile.lastModified),
      summary: {
        path: cache.cacheFile.path,
        sizeBytes: cache.cacheFile.sizeBytes,
        decryptedBytes: cache.decryptedBytes,
      },
      message:
        status === "healthy"
          ? "AlecaFrame account cache is readable and fresh."
          : "AlecaFrame cache is readable but stale. Open Warframe with AlecaFrame running, then import again.",
    };
  } catch (error) {
    return {
      status: "waiting",
      label: "AlecaFrame Cache",
      message: error instanceof Error ? error.message : "AlecaFrame cache is not readable.",
    };
  }
}

async function fissuresCheck(origin: string): Promise<HealthCheck> {
  const result = await fetchJson<unknown[]>(`${origin}/api/fissures`, 15000);
  if (!result.ok || !Array.isArray(result.data)) {
    return {
      status: "error",
      label: "World Fissures",
      lastUpdated: result.checkedAt,
      message: result.error ?? "Unable to load fissures.",
    };
  }

  const status = result.data.length > 0 ? timedStatus(result.checkedAt, WORLD_HEALTH_MS, WORLD_STALE_MS) : "degraded";

  return {
    status,
    label: "World Fissures",
    lastUpdated: result.checkedAt,
    ageSeconds: ageSecondsFrom(result.checkedAt),
    summary: { activeFissures: result.data.length },
    message:
      result.data.length > 0
        ? "Live fissure list loaded from Warframe world state."
        : "World state loaded but did not include active fissures.",
  };
}

async function baroCheck(origin: string): Promise<HealthCheck> {
  const result = await fetchJson<Record<string, unknown>>(`${origin}/api/baro`, 15000);
  if (!result.ok || !result.data) {
    return {
      status: "error",
      label: "Baro Status",
      lastUpdated: result.checkedAt,
      message: result.error ?? "Unable to load Baro status.",
    };
  }

  const hasError = typeof result.data.error === "string";
  const inventory = Array.isArray(result.data.inventory) ? result.data.inventory : [];

  return {
    status: hasError ? "error" : timedStatus(result.checkedAt, BARO_HEALTH_MS),
    label: "Baro Status",
    lastUpdated: result.checkedAt,
    ageSeconds: ageSecondsFrom(result.checkedAt),
    summary: {
      character: typeof result.data.character === "string" ? result.data.character : "Baro Ki'Teer",
      location: typeof result.data.location === "string" ? result.data.location : undefined,
      inventoryItems: inventory.length,
      activation: typeof result.data.activation === "string" ? result.data.activation : undefined,
      expiry: typeof result.data.expiry === "string" ? result.data.expiry : undefined,
    },
    message: hasError
      ? String(result.data.error)
      : "Baro timing and current visit status loaded from Warframe world state.",
  };
}

async function primeMarketCheck(): Promise<HealthCheck> {
  const analysis = await getPrimePartAnalysis({ includeMarket: false });
  const partNames = analysis.parts.map((part) => part.partName);
  const cache = await getPrimePartMarketCacheHealth(partNames, { maxAgeMs: MARKET_HEALTH_MS });

  if (cache.requested === 0) {
    return {
      status: analysis.accountStatus.hasSnapshot ? "waiting" : "degraded",
      label: "Warframe Market",
      summary: { accountPrimeParts: analysis.accountStatus.summary?.primePartCount ?? 0 },
      message: "No real account prime parts are available for market pricing yet.",
    };
  }

  const status: HealthCheckStatus =
    cache.stale > 0
      ? "stale"
      : cache.retryableIssues > 0 || cache.rateLimited
        ? "degraded"
        : "healthy";

  return {
    status,
    label: "Warframe Market",
    lastUpdated: cache.newestFetchedAt,
    ageSeconds: ageSecondsFrom(cache.newestFetchedAt),
    summary: {
      requested: cache.requested,
      priced: cache.priced,
      missing: cache.missing,
      failed: cache.failed,
      stale: cache.stale,
      unavailable: cache.unavailable,
      retryableIssues: cache.retryableIssues,
      rateLimited: cache.rateLimited,
      cachePath: cache.cachePath,
    },
    message:
      status === "healthy"
        ? "Prime part market cache is fresh."
        : "Prime part market cache has retryable missing, stale, or rate-limited entries. Use Refresh Market Prices.",
  };
}

async function googleSheetCheck(origin: string): Promise<HealthCheck> {
  const result = await fetchJson<{
    fetchedAt?: string;
    count?: number;
    tabs?: string[];
    source?: string;
    error?: string;
  }>(`${origin}/api/baro-compendium`, 20000);

  if (!result.ok || result.data?.error) {
    return {
      status: "error",
      label: "Google Sheet",
      lastUpdated: result.checkedAt,
      message: result.data?.error ?? result.error ?? "Unable to load Google Sheet compendium.",
    };
  }

  const fetchedAt = result.data?.fetchedAt ?? result.checkedAt;
  const status = (result.data?.count ?? 0) > 0 ? timedStatus(fetchedAt, SHEET_HEALTH_MS) : "degraded";

  return {
    status,
    label: "Google Sheet",
    lastUpdated: fetchedAt,
    ageSeconds: ageSecondsFrom(fetchedAt),
    summary: {
      rows: result.data?.count ?? 0,
      tabs: result.data?.tabs?.join(", "),
      source: result.data?.source,
    },
    message:
      status === "healthy"
        ? "Baro recommendation compendium loaded."
        : "Google Sheet compendium is stale or empty. Use Sync Google Sheet.",
  };
}

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString();
  const origin = request.nextUrl.origin;

  const [accountInventory, alecaframeCache, fissures, baro, primeMarket, googleSheet] =
    await Promise.all([
      accountInventoryCheck(),
      alecaframeCacheCheck(),
      fissuresCheck(origin),
      baroCheck(origin),
      primeMarketCheck(),
      googleSheetCheck(origin),
    ]);

  const checks = {
    accountInventory,
    alecaframeCache,
    fissures,
    baro,
    primeMarket,
    googleSheet,
  };

  return NextResponse.json(
    {
      overall: buildOverall(checks),
      checkedAt,
      checks,
    } satisfies DataHealthResponse,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

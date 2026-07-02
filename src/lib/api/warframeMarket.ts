import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readJsonResponse } from "@/lib/http/json";
import type { MarketPrice, MarketPricingIssue } from "@/types/market";

const MARKET_V2_BASE = "https://api.warframe.market/v2";
const DATA_DIR = path.join(process.cwd(), ".void-ledger");
const CACHE_PATH = path.join(DATA_DIR, "prime-part-market-prices.json");
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_REQUEST_DELAY_MS = 450;
const RATE_LIMIT_RETRY_DELAY_MS = 2000;

type MarketCacheEntry = {
  price?: Omit<MarketPrice, "lastUpdated"> & { lastUpdated: string };
  error?: string;
  fetchedAt: string;
};

type MarketCacheFile = {
  version: 1;
  entries: Record<string, MarketCacheEntry>;
};

export type MarketRefreshMode = "retry-issues" | "refresh-stale" | "refresh-all";

export type PrimePartMarketCacheHealth = {
  requested: number;
  priced: number;
  failed: number;
  missing: number;
  stale: number;
  unavailable: number;
  retryableIssues: number;
  rateLimited: boolean;
  oldestFetchedAt?: string;
  newestFetchedAt?: string;
  cachePath: string;
  issues: MarketPricingIssue[];
};

type MarketReadResult = {
  prices: Map<string, MarketPrice>;
  errors: Map<string, string>;
  status: {
    requested: number;
    priced: number;
    fromCache: number;
    fetched: number;
    failed: number;
    missing: number;
    stale: number;
    unavailable: number;
    retryableIssues: number;
    issues: MarketPricingIssue[];
    cachePath: string;
    refreshedAt: string;
    message: string;
    readOnly: boolean;
  };
};

type WarframeMarketOrder = {
  platinum?: number;
  quantity?: number;
  type?: "sell" | "buy";
};

type WarframeMarketTopOrdersResponse = {
  data?: {
    sell?: WarframeMarketOrder[];
    buy?: WarframeMarketOrder[];
  };
};

class MarketRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number
  ) {
    super(message);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAscii(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

export function marketSlugFromPartName(partName: string) {
  return normalizeAscii(partName);
}

export function isUnavailableMarketError(error?: string) {
  return Boolean(error && /\b404\b|not found/i.test(error));
}

function isRateLimitError(error?: string) {
  return Boolean(error && (/\b429\b/.test(error) || /too many requests/i.test(error)));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function fetchedAtMs(entry?: MarketCacheEntry) {
  const fetchedAt = entry ? new Date(entry.fetchedAt).getTime() : Number.NaN;
  return Number.isFinite(fetchedAt) ? fetchedAt : null;
}

function isStale(entry: MarketCacheEntry, maxAgeMs: number) {
  const checkedAt = fetchedAtMs(entry);
  return checkedAt === null || Date.now() - checkedAt > maxAgeMs;
}

function issueMessage(issue: MarketPricingIssue) {
  if (issue.error) return issue.error;
  if (issue.status === "missing") return "Market price missing from local cache. Use Retry Issues.";
  if (issue.status === "stale") return "Cached market price is stale. Use Refresh Stale or Retry Issues.";
  if (issue.status === "unavailable") return "No Warframe Market listing found.";
  return "Market lookup failed. Use Retry Issues.";
}

function classifyIssue(
  partName: string,
  entry: MarketCacheEntry | undefined,
  maxAgeMs: number
): MarketPricingIssue | null {
  const slug = marketSlugFromPartName(partName);

  if (!entry) {
    return {
      partName,
      slug,
      status: "missing",
      retryable: true,
    };
  }

  if (entry.error) {
    const unavailable = isUnavailableMarketError(entry.error);
    return {
      partName,
      slug,
      status: unavailable ? "unavailable" : "transient-error",
      error: unavailable ? "No Warframe Market listing found." : entry.error,
      lastChecked: entry.fetchedAt,
      retryable: !unavailable,
    };
  }

  if (entry.price && isStale(entry, maxAgeMs)) {
    return {
      partName,
      slug,
      status: "stale",
      lastChecked: entry.fetchedAt,
      retryable: true,
    };
  }

  return null;
}

function reviveMarketPrice(entry: MarketCacheEntry): MarketPrice | null {
  if (!entry.price) return null;

  return {
    ...entry.price,
    lastUpdated: new Date(entry.price.lastUpdated),
  };
}

async function readCache(): Promise<MarketCacheFile> {
  try {
    const parsed = JSON.parse(await readFile(CACHE_PATH, "utf8")) as Partial<MarketCacheFile>;
    return {
      version: 1,
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
    };
  } catch {
    return { version: 1, entries: {} };
  }
}

async function writeCache(cache: MarketCacheFile) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function buildReadResult(
  partNames: string[],
  cache: MarketCacheFile,
  {
    maxAgeMs,
    fetched = 0,
    failed,
    message,
    readOnly = true,
  }: {
    maxAgeMs: number;
    fetched?: number;
    failed?: number;
    message?: string;
    readOnly?: boolean;
  }
): MarketReadResult {
  const uniqueNames = [...new Set(partNames.filter(Boolean))];
  const prices = new Map<string, MarketPrice>();
  const errors = new Map<string, string>();
  const issues: MarketPricingIssue[] = [];
  let fromCache = 0;

  for (const name of uniqueNames) {
    const slug = marketSlugFromPartName(name);
    const entry = cache.entries[slug];

    if (entry) fromCache += 1;

    const cachedPrice = entry ? reviveMarketPrice(entry) : null;
    if (cachedPrice) {
      prices.set(name, { ...cachedPrice, source: "cache" });
    }

    const issue = classifyIssue(name, entry, maxAgeMs);
    if (issue) {
      const issueWithMessage = { ...issue, error: issueMessage(issue) };
      issues.push(issueWithMessage);
      errors.set(name, issueWithMessage.error);
    }
  }

  const transientErrors = issues.filter((issue) => issue.status === "transient-error").length;
  const unavailable = issues.filter((issue) => issue.status === "unavailable").length;
  const missing = issues.filter((issue) => issue.status === "missing").length;
  const stale = issues.filter((issue) => issue.status === "stale").length;
  const retryableIssues = issues.filter((issue) => issue.retryable).length;
  const currentFailures = transientErrors + unavailable;
  const statusMessage =
    message ??
    (retryableIssues > 0
      ? "Local market cache has retryable missing, stale, or transient entries."
      : unavailable > 0
        ? "Local market cache is priced; some parts have no Warframe Market listing."
        : "Local market cache is ready.");

  return {
    prices,
    errors,
    status: {
      requested: uniqueNames.length,
      priced: prices.size,
      fromCache,
      fetched,
      failed: failed ?? currentFailures,
      missing,
      stale,
      unavailable,
      retryableIssues,
      issues,
      cachePath: CACHE_PATH,
      refreshedAt: new Date().toISOString(),
      message: statusMessage,
      readOnly,
    },
  };
}

export async function readPrimePartMarketPrices(
  partNames: string[],
  { maxAgeMs = DEFAULT_MAX_AGE_MS }: { maxAgeMs?: number } = {}
) {
  const cache = await readCache();
  return buildReadResult(partNames, cache, {
    maxAgeMs,
    readOnly: true,
  });
}

export async function getPrimePartMarketCacheHealth(
  partNames: string[],
  { maxAgeMs = DEFAULT_MAX_AGE_MS }: { maxAgeMs?: number } = {}
): Promise<PrimePartMarketCacheHealth> {
  const cache = await readCache();
  const uniqueNames = [...new Set(partNames.filter(Boolean))];
  const readResult = buildReadResult(uniqueNames, cache, { maxAgeMs, readOnly: true });
  let oldestFetchedAtMs = Number.POSITIVE_INFINITY;
  let newestFetchedAtMs = 0;

  for (const name of uniqueNames) {
    const entry = cache.entries[marketSlugFromPartName(name)];
    const fetchedMs = fetchedAtMs(entry);
    if (fetchedMs === null) continue;
    oldestFetchedAtMs = Math.min(oldestFetchedAtMs, fetchedMs);
    newestFetchedAtMs = Math.max(newestFetchedAtMs, fetchedMs);
  }

  return {
    requested: readResult.status.requested,
    priced: readResult.status.priced,
    failed: readResult.status.failed,
    missing: readResult.status.missing,
    stale: readResult.status.stale,
    unavailable: readResult.status.unavailable,
    retryableIssues: readResult.status.retryableIssues,
    rateLimited: readResult.status.issues.some((issue) => isRateLimitError(issue.error)),
    oldestFetchedAt:
      Number.isFinite(oldestFetchedAtMs) && oldestFetchedAtMs !== Number.POSITIVE_INFINITY
        ? new Date(oldestFetchedAtMs).toISOString()
        : undefined,
    newestFetchedAt: newestFetchedAtMs > 0 ? new Date(newestFetchedAtMs).toISOString() : undefined,
    cachePath: CACHE_PATH,
    issues: readResult.status.issues,
  };
}

async function fetchTopOrders(slug: string, itemName: string): Promise<MarketPrice> {
  const response = await fetch(`${MARKET_V2_BASE}/orders/item/${encodeURIComponent(slug)}/top`, {
    headers: {
      accept: "application/json",
      language: "en",
      platform: "pc",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const retryAfterHeader = response.headers.get("retry-after");
    let retryAfterMs: number | undefined;

    if (retryAfterHeader) {
      // HTTP spec allows Retry-After to be either seconds (number) or HTTP-date
      const retryAfterNumber = Number(retryAfterHeader);
      if (Number.isFinite(retryAfterNumber) && retryAfterNumber > 0) {
        // It's a number representing seconds
        retryAfterMs = retryAfterNumber * 1000;
      } else {
        // It might be an HTTP-date - try to parse it
        const retryAfterDate = new Date(retryAfterHeader);
        if (!Number.isNaN(retryAfterDate.getTime())) {
          const delayMs = retryAfterDate.getTime() - Date.now();
          if (delayMs > 0) {
            retryAfterMs = delayMs;
          }
        }
      }
    }

    throw new MarketRequestError(
      `Warframe Market ${response.status} ${response.statusText}`,
      response.status,
      retryAfterMs
    );
  }

  const body = await readJsonResponse<WarframeMarketTopOrdersResponse>(response, {
    emptyMessage: "Warframe Market top-order response was empty.",
    invalidMessage: "Warframe Market top-order response was not valid JSON.",
  });
  const sellPrices = (body.data?.sell ?? [])
    .map((order) => order.platinum)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const buyPrices = (body.data?.buy ?? [])
    .map((order) => order.platinum)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  const lowestOnlineSell = sellPrices.length > 0 ? Math.min(...sellPrices) : 0;
  const medianOnlineSell = median(sellPrices);
  const highestBuyOrder = buyPrices.length > 0 ? Math.max(...buyPrices) : 0;
  const liquidPlatEstimate = Math.max(highestBuyOrder, lowestOnlineSell);

  return {
    itemName,
    marketUrlName: slug,
    lowestOnlineSell,
    medianOnlineSell,
    highestBuyOrder,
    liquidPlatEstimate,
    volume: sellPrices.length + buyPrices.length,
    source: "warframe-market-v2",
    lastUpdated: new Date(),
  };
}

async function fetchTopOrdersWithRetry(slug: string, itemName: string) {
  try {
    return await fetchTopOrders(slug, itemName);
  } catch (error) {
    if (!(error instanceof MarketRequestError) || error.status !== 429) throw error;

    await delay(error.retryAfterMs ?? RATE_LIMIT_RETRY_DELAY_MS);
    return fetchTopOrders(slug, itemName);
  }
}

function shouldRefreshIssue(mode: MarketRefreshMode, issue: MarketPricingIssue | null) {
  if (mode === "refresh-all") return true;
  if (!issue) return false;
  if (mode === "refresh-stale") return issue.status === "stale";
  return issue.retryable;
}

export async function refreshPrimePartMarketPrices(
  partNames: string[],
  {
    mode = "retry-issues",
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  }: {
    mode?: MarketRefreshMode;
    maxAgeMs?: number;
  } = {}
) {
  const cache = await readCache();
  const uniqueNames = [...new Set(partNames.filter(Boolean))];
  const pending = uniqueNames.filter((name) => {
    const issue = classifyIssue(name, cache.entries[marketSlugFromPartName(name)], maxAgeMs);
    return shouldRefreshIssue(mode, issue);
  });

  let fetched = 0;
  let failed = 0;

  for (const [index, name] of pending.entries()) {
    if (index > 0) await delay(RATE_LIMIT_REQUEST_DELAY_MS);

    const slug = marketSlugFromPartName(name);
    try {
      const price = await fetchTopOrdersWithRetry(slug, name);
      cache.entries[slug] = {
        price: { ...price, lastUpdated: price.lastUpdated.toISOString() },
        fetchedAt: new Date().toISOString(),
      };
      fetched += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Market lookup failed";
      cache.entries[slug] = {
        error: message,
        fetchedAt: new Date().toISOString(),
      };
      failed += 1;
    }
  }

  if (pending.length > 0) {
    await writeCache(cache);
  }

  return buildReadResult(uniqueNames, cache, {
    maxAgeMs,
    fetched,
    failed,
    readOnly: false,
    message:
      pending.length === 0
        ? "No market entries matched this refresh mode."
        : `Market refresh completed: ${fetched.toLocaleString()} fetched, ${failed.toLocaleString()} failed.`,
  });
}

export async function fetchMarketPrices(partName: string): Promise<MarketPrice> {
  const slug = marketSlugFromPartName(partName);
  return fetchTopOrders(slug, partName);
}

export async function getPrimePartMarketPrices(
  partNames: string[],
  {
    refresh = false,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  }: {
    refresh?: boolean;
    maxAgeMs?: number;
  } = {}
) {
  return refresh
    ? refreshPrimePartMarketPrices(partNames, { mode: "refresh-all", maxAgeMs })
    : readPrimePartMarketPrices(partNames, { maxAgeMs });
}

export async function fetchAllPrimePrices(partNames: string[]): Promise<Map<string, MarketPrice>> {
  return (await refreshPrimePartMarketPrices(partNames, { mode: "refresh-all" })).prices;
}

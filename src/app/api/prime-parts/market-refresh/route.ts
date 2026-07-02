import { NextRequest, NextResponse } from "next/server";
import { refreshPrimePartMarketPrices, type MarketRefreshMode } from "@/lib/api/warframeMarket";
import { getPrimePartAnalysis } from "@/lib/inventory/primePartAnalysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFRESH_MODES = new Set<MarketRefreshMode>(["retry-issues", "refresh-stale", "refresh-all"]);

function parseMode(value: unknown): MarketRefreshMode {
  return typeof value === "string" && REFRESH_MODES.has(value as MarketRefreshMode)
    ? (value as MarketRefreshMode)
    : "retry-issues";
}

export async function POST(request: NextRequest) {
  let body: unknown = null;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const mode = parseMode(
    body && typeof body === "object" && "mode" in body ? (body as { mode?: unknown }).mode : undefined
  );
  const baseline = await getPrimePartAnalysis({ includeMarket: false });
  const partNames = baseline.parts.map((part) => part.partName);
  const refresh = await refreshPrimePartMarketPrices(partNames, { mode });
  const analysis = await getPrimePartAnalysis({ includeMarket: true });

  return NextResponse.json(
    {
      ...analysis,
      marketStatus: {
        ...analysis.marketStatus,
        fetched: refresh.status.fetched,
        failed: refresh.status.failed,
        refreshedAt: refresh.status.refreshedAt,
        message: refresh.status.message,
        readOnly: false,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

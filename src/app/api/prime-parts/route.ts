import { NextRequest, NextResponse } from "next/server";
import { getPrimePartAnalysis } from "@/lib/inventory/primePartAnalysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const includeMarket = request.nextUrl.searchParams.get("market") !== "0";
  const refreshMarket = request.nextUrl.searchParams.get("refreshMarket") === "1";
  const analysis = await getPrimePartAnalysis({ includeMarket, refreshMarket });

  return NextResponse.json(analysis, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

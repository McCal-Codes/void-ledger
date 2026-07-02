import { NextResponse } from "next/server";
import { fetchWarframeWorldState } from "@/lib/api/warframeWorldState";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const worldState = await fetchWarframeWorldState();
    return NextResponse.json(worldState, { status: worldState.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load Warframe world state.",
      },
      { status: 502 }
    );
  }
}

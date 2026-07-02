import { NextResponse } from "next/server";
import { enrichBaroItemsWithAssets } from "@/lib/account/accountItemAssets";
import { BaroItem } from "@/types/baro";

const SHEET_ID = "1vS6INzXE-VwdaFk6v9DGyXl2AhtyWUFmFifAls2mpyU";
const SHEET_TABS = ["Mods", "Weapon/Sentinel", "Cosmetics", "Extras"] as const;
const GOOGLE_SHEETS_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;

type SheetTab = (typeof SHEET_TABS)[number];

type GoogleCell = {
  v?: unknown;
  f?: string;
};

type GoogleRow = {
  c?: Array<GoogleCell | null>;
};

type GoogleTable = {
  rows?: GoogleRow[];
};

type GoogleSheetResponse = {
  table?: GoogleTable;
};

type CompendiumRow = {
  type: string;
  item: string;
  ducats: number;
  credits: number;
  ranking: string;
  notes: string;
  internalName: string;
};

type TabConfig = {
  category: (row: CompendiumRow) => BaroItem["category"];
  rankingIndex?: number;
  notesIndex: number;
  internalNameIndex: number;
};

const TAB_CONFIG: Record<SheetTab, TabConfig> = {
  Mods: {
    category: (row) => (row.item.startsWith("Primed ") ? "Primed Mod" : "Mod"),
    rankingIndex: 5,
    notesIndex: 6,
    internalNameIndex: 10,
  },
  "Weapon/Sentinel": {
    category: () => "Weapon",
    rankingIndex: 5,
    notesIndex: 6,
    internalNameIndex: 10,
  },
  Cosmetics: {
    category: (row) => (row.type.toLowerCase().includes("decoration") ? "Decoration" : "Cosmetic"),
    notesIndex: 5,
    internalNameIndex: 9,
  },
  Extras: {
    category: (row) => (row.type.toLowerCase().includes("decoration") ? "Decoration" : "Other"),
    notesIndex: 5,
    internalNameIndex: 9,
  },
};

export async function GET() {
  try {
    const tabResults = await Promise.all(SHEET_TABS.map(fetchTabItems));
    const items = await enrichBaroItemsWithAssets(dedupeItems(tabResults.flat()));

    return NextResponse.json(
      {
        source: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`,
        tabs: SHEET_TABS,
        fetchedAt: new Date().toISOString(),
        count: items.length,
        items,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching Baro compendium:", error);
    return NextResponse.json(
      { error: "Failed to fetch Baro recommendation compendium" },
      { status: 500 }
    );
  }
}

async function fetchTabItems(tab: SheetTab): Promise<BaroItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `${GOOGLE_SHEETS_BASE}?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tab}: ${response.statusText}`);
    }

    const jsonp = await response.text();
    const sheet = parseGoogleVisualizationResponse(jsonp);
    const rows = sheet.table?.rows ?? [];
    const config = TAB_CONFIG[tab];

    return rows
      .map((row) => toCompendiumRow(row, config))
      .filter(isImportableRow)
      .map((row) => toBaroItem(row, config, tab));
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseGoogleVisualizationResponse(jsonp: string): GoogleSheetResponse {
  const jsonStart = jsonp.indexOf("{");
  const jsonEnd = jsonp.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("Invalid Google Sheets response");
  }

  return JSON.parse(jsonp.slice(jsonStart, jsonEnd + 1)) as GoogleSheetResponse;
}

function toCompendiumRow(row: GoogleRow, config: TabConfig): CompendiumRow {
  const cells = row.c ?? [];

  return {
    type: readString(cells[0]),
    item: readString(cells[1]),
    ducats: readNumber(cells[2]),
    credits: readNumber(cells[3]),
    ranking: config.rankingIndex === undefined ? "" : readString(cells[config.rankingIndex]),
    notes: readString(cells[config.notesIndex]),
    internalName: readString(cells[config.internalNameIndex]),
  };
}

function isImportableRow(row: CompendiumRow): boolean {
  return row.item.length > 0 && (row.ducats > 0 || row.credits > 0);
}

function toBaroItem(row: CompendiumRow, config: TabConfig, tab: SheetTab): BaroItem {
  const category = config.category(row);
  const notes = row.ranking ? `Rank ${row.ranking}: ${row.notes}` : row.notes;

  return {
    id: row.internalName || `baro-compendium:${tab}:${normalizeId(row.item)}`,
    name: row.item,
    category,
    ducatCost: row.ducats,
    creditCost: row.credits,
    tradable: category === "Primed Mod" || category === "Mod" || category === "Weapon",
    owned: false,
    recommendedPriority: mapRankingToPriority(row.ranking),
    notes,
    source: "community",
    lastUpdated: new Date(),
    internalName: row.internalName || undefined,
  };
}

function dedupeItems(items: BaroItem[]): BaroItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapRankingToPriority(ranking: string): BaroItem["recommendedPriority"] {
  const normalized = ranking.trim().toUpperCase();

  if (normalized === "S") return "Must Have";
  if (normalized === "A") return "High";
  if (normalized === "B" || normalized === "C") return "Medium";
  if (normalized === "F") return "Skip";
  return "Low";
}

function readString(cell: GoogleCell | null | undefined): string {
  const value = cell?.v;
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(cell: GoogleCell | null | undefined): number {
  const value = cell?.v;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;

  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

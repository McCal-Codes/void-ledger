export type WorldStateResponse = {
  ok: boolean;
  platform?: string;
  syncedAt?: string;
  timestamp?: string | null;
  voidTrader?: unknown;
  sortie?: unknown;
  archonHunt?: unknown;
  nightwave?: unknown;
  steelPath?: unknown;
  duviriCycle?: unknown;
  cycles?: Record<string, unknown>;
  alerts?: unknown[];
  events?: unknown[];
  invasions?: unknown[];
  fissures?: unknown[];
  error?: string;
};

const WORLD_STATE_URL = "https://api.warframestat.us/pc";
const RAW_WORLD_STATE_URL = "https://content.warframe.com/dynamic/worldState.php";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function limitArray(value: unknown, limit: number) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readRawDate(value: unknown) {
  const millis = Number(asRecord(asRecord(value).$date).$numberLong);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : undefined;
}

function titleCaseCode(value: unknown, fallback: string) {
  const label = readText(value, fallback)
    .replace(/^(MT_|FC_|SORTIE_BOSS_)/, "")
    .replace(/_/g, " ")
    .toLowerCase();
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readRawId(value: Record<string, unknown>) {
  return readText(asRecord(value._id).$oid, "World-state item");
}

function mapRawMission(value: unknown) {
  const mission = asRecord(value);
  const modifier = readText(mission.Modifier);
  const tiers: Record<string, string> = {
    VoidT1: "Lith",
    VoidT2: "Meso",
    VoidT3: "Neo",
    VoidT4: "Axi",
    VoidT5: "Requiem",
    VoidT6: "Omnia",
  };
  return {
    id: readRawId(mission),
    tier: tiers[modifier] ?? modifier,
    missionType: titleCaseCode(mission.MissionType, "Mission"),
    node: readText(mission.Node, "Unknown node"),
    faction: titleCaseCode(mission.Faction, "Unknown"),
    activation: readRawDate(mission.Activation),
    expiry: readRawDate(mission.Expiry),
    isHard: mission.Hard === true,
  };
}

function mapRawWorldState(raw: Record<string, unknown>): WorldStateResponse {
  const trader = asRecord(limitArray(raw.VoidTraders, 1)[0]);
  const sortie = asRecord(limitArray(raw.Sorties, 1)[0]);
  const timestampSeconds = typeof raw.Time === "number" ? raw.Time : Number(raw.Time);

  return {
    ok: true,
    platform: "pc",
    syncedAt: new Date().toISOString(),
    timestamp: Number.isFinite(timestampSeconds)
      ? new Date(timestampSeconds * 1000).toISOString()
      : null,
    voidTrader: Object.keys(trader).length
      ? {
          character: readText(trader.Character, "Void Trader"),
          location: readText(trader.Node, "Unknown relay"),
          activation: readRawDate(trader.Activation),
          expiry: readRawDate(trader.Expiry),
        }
      : null,
    sortie: Object.keys(sortie).length
      ? {
          boss: titleCaseCode(sortie.Boss, "Sortie"),
          expiry: readRawDate(sortie.Expiry),
        }
      : null,
    nightwave: raw.SeasonInfo ?? null,
    cycles: {},
    alerts: limitArray(raw.Alerts, 8).map((value) => {
      const alert = asRecord(value);
      const missionInfo = asRecord(alert.MissionInfo);
      return {
        id: readRawId(alert),
        description: readText(alert.Tag, "Alert"),
        node: readText(missionInfo.location, "Unknown node"),
        expiry: readRawDate(alert.Expiry),
      };
    }),
    events: limitArray(raw.Events, 8).map((value) => {
      const event = asRecord(value);
      return {
        id: readRawId(event),
        description: readText(event.Tag, readText(event.Description, "World event")),
        expiry: readRawDate(event.Expiry),
      };
    }),
    invasions: limitArray(raw.Invasions, 10).map((value) => {
      const invasion = asRecord(value);
      const count = Number(invasion.Count);
      const goal = Number(invasion.Goal);
      return {
        id: readRawId(invasion),
        missionType: "Invasion",
        node: readText(invasion.Node, "Unknown node"),
        faction: titleCaseCode(invasion.Faction, "Unknown"),
        completion: Number.isFinite(count) && Number.isFinite(goal) && goal > 0
          ? (count / goal) * 100
          : undefined,
      };
    }),
    fissures: limitArray(raw.ActiveMissions, 12).map(mapRawMission),
  };
}

async function readJsonRecord(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return asRecord(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

async function fetchRawWorldState(): Promise<WorldStateResponse> {
  const response = await fetch(RAW_WORLD_STATE_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `Warframe raw world-state request failed: ${response.status} ${response.statusText}`,
    };
  }

  const raw = await readJsonRecord(response);
  if (!raw) {
    return { ok: false, error: "Warframe raw world-state response was empty or invalid." };
  }

  return mapRawWorldState(raw);
}

export async function fetchWarframeWorldState(): Promise<WorldStateResponse> {
  try {
    const response = await fetch(WORLD_STATE_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      const worldState = await readJsonRecord(response);
      if (worldState) {
        return {
          ok: true,
          platform: "pc",
          syncedAt: new Date().toISOString(),
          timestamp: typeof worldState.timestamp === "string" ? worldState.timestamp : null,
          voidTrader: worldState.voidTrader ?? null,
          sortie: worldState.sortie ?? null,
          archonHunt: worldState.archonHunt ?? null,
          nightwave: worldState.nightwave ?? null,
          steelPath: worldState.steelPath ?? null,
          duviriCycle: worldState.duviriCycle ?? null,
          cycles: {
            earth: worldState.earthCycle ?? null,
            cetus: worldState.cetusCycle ?? null,
            vallis: worldState.vallisCycle ?? null,
            cambion: worldState.cambionCycle ?? null,
          },
          alerts: limitArray(worldState.alerts, 8),
          events: limitArray(worldState.events, 8),
          invasions: limitArray(worldState.invasions, 10),
          fissures: limitArray(worldState.fissures, 12),
        };
      }
    }
  } catch {
    // The raw Digital Extremes feed remains the real-data fallback.
  }

  return fetchRawWorldState();
}

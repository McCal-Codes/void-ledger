import { NextResponse } from 'next/server';

const WORLDSTATE_URL = 'https://api.warframestat.us/pc?language=en';
const RAW_WORLDSTATE_URL = 'https://content.warframe.com/dynamic/worldState.php';

type RawWorldStateDate = {
  $date?: {
    $numberLong?: string;
  };
};

type RawActiveMission = {
  _id?: {
    $oid?: string;
  };
  Activation?: RawWorldStateDate;
  Expiry?: RawWorldStateDate;
  Node?: string;
  MissionType?: string;
  Modifier?: string;
  Hard?: boolean;
};

const TIER_BY_MODIFIER: Record<string, string> = {
  VoidT1: 'Lith',
  VoidT2: 'Meso',
  VoidT3: 'Neo',
  VoidT4: 'Axi',
  VoidT5: 'Requiem',
  VoidT6: 'Omnia',
};

const MISSION_TYPE_LABELS: Record<string, string> = {
  MT_ALCHEMY: 'Alchemy',
  MT_ASSASSINATION: 'Assassination',
  MT_CAPTURE: 'Capture',
  MT_DEFENSE: 'Defense',
  MT_EXCAVATE: 'Excavation',
  MT_EXTERMINATION: 'Exterminate',
  MT_INTEL: 'Spy',
  MT_MOBILE_DEFENSE: 'Mobile Defense',
  MT_RESCUE: 'Rescue',
  MT_SABOTAGE: 'Sabotage',
  MT_SURVIVAL: 'Survival',
};

const NODE_LABELS: Record<string, string> = {
  SolNode3: 'E Prime (Earth)',
  SolNode5: 'Mantle (Earth)',
  SolNode6: 'Gaia (Earth)',
  SolNode8: 'Eurasia (Earth)',
  SolNode10: 'Lith (Earth)',
  SolNode22: 'Ishtar (Venus)',
  SolNode31: 'Unda (Venus)',
  SolNode33: 'V Prime (Venus)',
  SolNode49: 'Caloris (Mercury)',
  SolNode54: 'Tolstoj (Mercury)',
  SolNode66: 'Augustus (Mars)',
  SolNode71: 'Syrtis (Mars)',
  SolNode80: 'Albedo (Ceres)',
  SolNode87: 'Elara (Jupiter)',
  SolNode101: 'Carpo (Jupiter)',
  SolNode108: 'Ara (Mars)',
  SolNode116: 'Stephano (Uranus)',
  SolNode128: 'Tessera (Venus)',
  SolNode164: 'Hydron (Sedna)',
  SolNode181: 'Adaro (Sedna)',
  SolNode186: 'Kappa (Sedna)',
  SolNode203: 'Abaddon (Europa)',
  SolNode309: 'Ani (Void)',
  SolNode316: 'Belenus (Void)',
  SolNode718: 'Persto (Zariman)',
};

type TransformedFissure = {
  id: string;
  tier: string;
  missionType: string;
  node: string;
  faction: string;
  activation: string;
  expiry: string;
  isHard: boolean;
};

function readRawDate(value: RawWorldStateDate | undefined) {
  const millis = Number(value?.$date?.$numberLong);
  if (!Number.isFinite(millis)) {
    console.warn("Invalid date format in world state data: - route.ts:78", value);
    return null;
  }
  return new Date(millis).toISOString();
}

function labelMissionType(value: string | undefined) {
  if (!value) return 'Unknown';
  return MISSION_TYPE_LABELS[value] ?? value.replace(/^MT_/, '').replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function transformRawFissure(mission: RawActiveMission): TransformedFissure | null {
  const modifier = mission.Modifier ?? '';
  const node = mission.Node ?? 'Unknown';

  const activation = readRawDate(mission.Activation);
  const expiry = readRawDate(mission.Expiry);

  // Skip fissures with invalid dates
  if (!activation || !expiry) {
    console.warn("Skipping fissure with invalid dates: - route.ts:108", { node, modifier });
    return null;
  }

  return {
    id: mission._id?.$oid ?? `${node}-${mission.Activation?.$date?.$numberLong ?? ''}`,
    tier: TIER_BY_MODIFIER[modifier] ?? (modifier.replace(/^Void/, 'Tier ') || 'Unknown'),
    missionType: labelMissionType(mission.MissionType),
    node: NODE_LABELS[node] ?? node,
    faction: 'Unknown',
    activation,
    expiry,
    isHard: mission.Hard === true,
  };
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(WORLDSTATE_URL, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch fissures: ${response.statusText}` },
        {
          status: response.status,
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const text = await response.text();
    const data = text.trim() ? JSON.parse(text) : null;
    let fissures = Array.isArray(data?.fissures) ? data.fissures : [];

    if (fissures.length === 0) {
      const rawResponse = await fetch(RAW_WORLDSTATE_URL, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (rawResponse.ok) {
        const rawData = await rawResponse.json();
        const activeMissions = Array.isArray(rawData?.ActiveMissions) ? rawData.ActiveMissions : [];
        fissures = activeMissions
          .map(transformRawFissure)
          .filter((f: TransformedFissure | null): f is TransformedFissure => f !== null);
      }
    }
    
    return NextResponse.json(fissures, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', // Cache for 1 minute, serve stale for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error fetching fissures: - route.ts:173', error);
    const errorMessage = error instanceof Error && error.name === 'AbortError' 
      ? 'Request timeout' 
      : 'Failed to fetch fissures';
    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

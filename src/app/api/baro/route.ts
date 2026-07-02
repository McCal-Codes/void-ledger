import { NextResponse } from 'next/server';

const WORLDSTATE_URL = 'https://api.warframestat.us/pc?language=en';
const RAW_WORLDSTATE_URL = 'https://content.warframe.com/dynamic/worldState.php';

type RawWorldStateDate = {
  $date?: {
    $numberLong?: string;
  };
};

type RawVoidTrader = {
  Activation?: RawWorldStateDate;
  Expiry?: RawWorldStateDate;
  Character?: string;
  Node?: string;
};

const NODE_LABELS: Record<string, string> = {
  MercuryHUB: 'Larunda Relay (Mercury)',
  VenusHUB: 'Vesper Relay (Venus)',
  EarthHUB: 'Strata Relay (Earth)',
  SaturnHUB: 'Kronia Relay (Saturn)',
  PlutoHUB: 'Orcus Relay (Pluto)',
  EuropaHUB: 'Leonov Relay (Europa)',
  ErisHUB: 'Kuiper Relay (Eris)',
};

function readRawDate(value: RawWorldStateDate | undefined) {
  const millis = Number(value?.$date?.$numberLong);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : undefined;
}

function transformRawVoidTrader(rawTrader: RawVoidTrader | null) {
  if (!rawTrader) return { inventory: [] };

  return {
    character: rawTrader.Character ?? "Baro Ki'Teer",
    location: NODE_LABELS[rawTrader.Node ?? ''] ?? rawTrader.Node ?? 'Unknown Relay',
    activation: readRawDate(rawTrader.Activation),
    expiry: readRawDate(rawTrader.Expiry),
    inventory: [],
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
        { error: `Failed to fetch Baro inventory: ${response.statusText}` },
        {
          status: response.status,
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const text = await response.text();
    const data = text.trim() ? JSON.parse(text) : null;
    let voidTrader = data?.voidTrader ?? null;

    if (!voidTrader) {
      const rawResponse = await fetch(RAW_WORLDSTATE_URL, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (rawResponse.ok) {
        const rawData = await rawResponse.json();
        voidTrader = transformRawVoidTrader(rawData?.VoidTraders ?? null);
      }
    }
    
    return NextResponse.json(voidTrader ?? { inventory: [] }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes, serve stale for 10 minutes
      },
    });
  } catch (error) {
    console.error('Error fetching Baro inventory:', error);
    const errorMessage = error instanceof Error && error.name === 'AbortError' 
      ? 'Request timeout' 
      : 'Failed to fetch Baro inventory';
    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

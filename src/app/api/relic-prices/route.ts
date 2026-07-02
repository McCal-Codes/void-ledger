import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Warframe.stat.us doesn't have a relics endpoint, return empty for now
    // In production, you'd need to use a different API or calculate from market data
    return NextResponse.json([], {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error fetching relic prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relic prices' },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

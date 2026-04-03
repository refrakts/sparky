import { type NextRequest, NextResponse } from 'next/server';

const SPARKSCAN_API_URL = process.env.SPARKSCAN_API_URL || 'https://api.sparkscan.io';

const NETWORK = 'MAINNET' as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const upstream = new URL(`/${path.join('/')}`, SPARKSCAN_API_URL);

    // Copy query params from the incoming request
    req.nextUrl.searchParams.forEach((value, key) => {
        upstream.searchParams.set(key, value);
    });

    // Always enforce MAINNET
    upstream.searchParams.set('network', NETWORK);

    try {
        const res = await fetch(upstream.toString());
        if (!res.ok) {
            return NextResponse.json(
                { error: `Upstream API error: ${res.status} ${res.statusText}` },
                { status: res.status },
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

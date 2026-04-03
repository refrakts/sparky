import { type NextRequest, NextResponse } from 'next/server';

const FLASHNET_API_URL = process.env.FLASHNET_API_URL || 'https://api.flashnet.xyz';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const upstream = new URL(`/${path.join('/')}`, FLASHNET_API_URL);

    // Copy query params from the incoming request
    req.nextUrl.searchParams.forEach((value, key) => {
        upstream.searchParams.set(key, value);
    });

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const upstream = new URL(`/${path.join('/')}`, FLASHNET_API_URL);

    // Copy query params from the incoming request
    req.nextUrl.searchParams.forEach((value, key) => {
        upstream.searchParams.set(key, value);
    });

    try {
        const body = await req.json();
        const res = await fetch(upstream.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
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

const SPARKSCAN_API_URL = process.env.SPARKSCAN_API_URL || 'https://api.sparkscan.io';

/**
 * SECURITY: Network is ALWAYS hardcoded to MAINNET.
 * The LLM never controls this parameter.
 */
const NETWORK = 'MAINNET' as const;

/**
 * Server-side only: fetch directly from the Sparkscan API.
 * Use this in API routes, server components, and AI tool handlers.
 */
export async function sparkscanFetch<T>(
    path: string,
    params?: Record<string, string | number | undefined | null>,
): Promise<T> {
    const url = new URL(path, SPARKSCAN_API_URL);
    url.searchParams.set('network', NETWORK);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) {
                url.searchParams.set(k, String(v));
            }
        }
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Sparkscan API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
}

// ─── Flashnet AMM API ───────────────────────────────────────────────

const FLASHNET_API_URL = process.env.FLASHNET_API_URL || 'https://api.flashnet.xyz';

/**
 * Server-side only: fetch directly from the Flashnet AMM API.
 * Use this in API routes, server components, and AI tool handlers.
 */
export async function flashnetFetch<T>(
    path: string,
    params?: Record<string, string | number | undefined | null>,
): Promise<T> {
    const url = new URL(path, FLASHNET_API_URL);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) {
                url.searchParams.set(k, String(v));
            }
        }
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Flashnet API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
}

/**
 * Client-safe: fetch through the Next.js proxy at /api/flashnet/[...path].
 * Use this in "use client" components.
 */
export async function flashnetProxyFetch<T>(
    path: string,
    params?: Record<string, string | number | undefined | null>,
): Promise<T> {
    const cleanPath = path.replace(/^\//, '');
    const url = new URL(`/api/flashnet/${cleanPath}`, window.location.origin);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) {
                url.searchParams.set(k, String(v));
            }
        }
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Flashnet proxy error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
}

/**
 * Client-safe: fetch through the Next.js proxy at /api/sparkscan/[...path].
 * The upstream URL and network param are handled server-side.
 * Use this in "use client" components.
 */
export async function sparkscanProxyFetch<T>(
    path: string,
    params?: Record<string, string | number | undefined | null>,
): Promise<T> {
    // Strip leading slash so it doesn't double up
    const cleanPath = path.replace(/^\//, '');
    const url = new URL(`/api/sparkscan/${cleanPath}`, window.location.origin);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) {
                url.searchParams.set(k, String(v));
            }
        }
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Sparkscan proxy error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
}

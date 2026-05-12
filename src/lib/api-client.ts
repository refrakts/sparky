/**
 * Client-safe fetchers that go through the Next.js proxy routes at
 * /api/sparkscan/[...path] and /api/flashnet/[...path]. The upstream URLs
 * and any server-side concerns (like Sparkscan's MAINNET enforcement) are
 * handled by those route handlers. This file imports no server env vars,
 * so it's safe to import from "use client" components.
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

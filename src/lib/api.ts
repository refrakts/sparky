import 'server-only';
import pLimit from 'p-limit';
import { env } from '@/env';

const SPARKSCAN_API_URL = env.SPARKSCAN_API_URL;

/**
 * SECURITY: Network is ALWAYS hardcoded to MAINNET.
 * The LLM never controls this parameter.
 */
const NETWORK = 'MAINNET' as const;

/**
 * Per-upstream concurrency caps. Prevents 429s when subagents fan out
 * (parallelAnalysis can spawn 6 workers, each calling 10 tools).
 */
const sparkscanLimit = pLimit(4);
const flashnetLimit = pLimit(4);

/**
 * Server-side only: fetch directly from the Sparkscan API.
 * Use this in API routes, server components, and AI tool handlers.
 */
export async function sparkscanFetch<T>(
    path: string,
    params?: Record<string, string | number | undefined | null>,
): Promise<T> {
    return sparkscanLimit(async () => {
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
    });
}

// ─── Flashnet AMM API ───────────────────────────────────────────────

const FLASHNET_API_URL = env.FLASHNET_API_URL;

/**
 * Server-side only: fetch directly from the Flashnet AMM API.
 * Use this in API routes, server components, and AI tool handlers.
 */
export async function flashnetFetch<T>(
    path: string,
    params?: Record<string, string | number | undefined | null>,
): Promise<T> {
    return flashnetLimit(async () => {
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
    });
}

/**
 * Server-side only: POST to the Flashnet AMM API. Shares the same concurrency
 * cap as flashnetFetch.
 */
export async function flashnetPost<T>(path: string, body: unknown): Promise<T> {
    return flashnetLimit(async () => {
        const url = new URL(path, FLASHNET_API_URL);
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`Flashnet API error: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<T>;
    });
}

'use client';

import { createContext, useCallback, useContext, useRef } from 'react';

/**
 * Client-side cache for tool-fetched data.
 * Tools store full API responses here keyed by toolCallId.
 * Components check this cache before self-fetching.
 */

interface DataCacheStore {
    entries: Map<string, { type: string; data: unknown; timestamp: number }>;
}

interface DataCacheContextValue {
    /** Store data from a tool result */
    set: (key: string, type: string, data: unknown) => void;
    /** Get cached data by type (returns the most recent entry of that type) */
    getByType: (type: string) => unknown | null;
    /** Get cached data by a type + key match (e.g., "address:sp1abc") */
    getByKey: (key: string) => unknown | null;
    /** Get all entries of a given type */
    getAllByType: (type: string) => Array<{ key: string; data: unknown }>;
}

const DataCacheContext = createContext<DataCacheContextValue | null>(null);

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
    const storeRef = useRef<DataCacheStore>({ entries: new Map() });

    const value: DataCacheContextValue = {
        set: useCallback((key, type, data) => {
            storeRef.current.entries.set(key, { type, data, timestamp: Date.now() });
        }, []),

        getByType: useCallback((type) => {
            let latest: { data: unknown; timestamp: number } | null = null;
            for (const entry of storeRef.current.entries.values()) {
                if (entry.type === type && (!latest || entry.timestamp > latest.timestamp)) {
                    latest = entry;
                }
            }
            return latest?.data ?? null;
        }, []),

        getByKey: useCallback((key) => {
            return storeRef.current.entries.get(key)?.data ?? null;
        }, []),

        getAllByType: useCallback((type) => {
            const results: Array<{ key: string; data: unknown }> = [];
            for (const [key, entry] of storeRef.current.entries) {
                if (entry.type === type) results.push({ key, data: entry.data });
            }
            return results;
        }, []),
    };

    return <DataCacheContext.Provider value={value}>{children}</DataCacheContext.Provider>;
}

export function useDataCache() {
    const ctx = useContext(DataCacheContext);
    if (!ctx) throw new Error('useDataCache must be used within DataCacheProvider');
    return ctx;
}

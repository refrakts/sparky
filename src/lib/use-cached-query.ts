'use client';

import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useDataCache } from './data-cache';

/**
 * Like useQuery, but checks the data cache first.
 * If the cache has data for the given tool type, uses it as initialData
 * so the component renders instantly without a network request.
 * The query still runs in the background to refresh (staleTime applies).
 */
export function useCachedQuery<T>(toolType: string, options: UseQueryOptions<T>) {
    const cache = useDataCache();
    const cached = cache.getByType(toolType) as T | null;

    return useQuery<T>({
        ...options,
        // Use cached data as initial data — renders instantly
        ...(cached ? { initialData: cached } : {}),
    });
}

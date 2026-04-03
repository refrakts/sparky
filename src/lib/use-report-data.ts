'use client';

import { useEffect, useId } from 'react';
import { type RenderedEntry, useRenderedContext } from './rendered-context';

/**
 * Hook for self-fetching components to report their data to the context store.
 * Call this after data is fetched so the LLM can reference it in follow-ups.
 */
export function useReportData(entry: Omit<RenderedEntry, 'renderedAt'> | null) {
    const { report, remove } = useRenderedContext();
    const id = useId();

    useEffect(() => {
        if (entry) {
            report(id, { ...entry, renderedAt: Date.now() });
        }
        return () => {
            remove(id);
        };
    }, [id, entry, report, remove]);
}

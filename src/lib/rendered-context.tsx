'use client';

import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';

/**
 * A compact summary of what a rendered component is displaying.
 * This gets injected into the LLM conversation so it can reference
 * on-screen data for follow-up questions.
 */
export interface RenderedEntry {
    /** Component type (e.g., "LatestTransactions", "AddressSummary") */
    component: string;
    /** Human-readable description of what's shown */
    summary: string;
    /** Key data points the LLM might need to reference */
    data: Record<string, unknown>;
    /** Timestamp when this was rendered */
    renderedAt: number;
}

interface RenderedContextStore {
    entries: Map<string, RenderedEntry>;
    listeners: Set<() => void>;
}

function createRenderedContextStore(): RenderedContextStore {
    return { entries: new Map(), listeners: new Set() };
}

interface RenderedContextValue {
    /** Report what a component is showing */
    report: (id: string, entry: RenderedEntry) => void;
    /** Remove a component's entry */
    remove: (id: string) => void;
    /** Get all entries as a serializable array */
    getEntries: () => RenderedEntry[];
    /** Get a compact text summary for the LLM */
    getSummary: () => string;
    /** Subscribe to changes */
    subscribe: (listener: () => void) => () => void;
}

const RenderedContext = createContext<RenderedContextValue | null>(null);

export function RenderedContextProvider({ children }: { children: React.ReactNode }) {
    const storeRef = useRef<RenderedContextStore>(createRenderedContextStore());

    const notify = useCallback(() => {
        storeRef.current.listeners.forEach((l) => l());
    }, []);

    const value: RenderedContextValue = {
        report: useCallback(
            (id, entry) => {
                storeRef.current.entries.set(id, entry);
                notify();
            },
            [notify],
        ),

        remove: useCallback(
            (id) => {
                storeRef.current.entries.delete(id);
                notify();
            },
            [notify],
        ),

        getEntries: useCallback(() => {
            return Array.from(storeRef.current.entries.values());
        }, []),

        getSummary: useCallback(() => {
            const entries = Array.from(storeRef.current.entries.values());
            if (entries.length === 0) return '';
            return entries.map((e) => `[${e.component}] ${e.summary}`).join('\n');
        }, []),

        subscribe: useCallback((listener: () => void) => {
            storeRef.current.listeners.add(listener);
            return () => {
                storeRef.current.listeners.delete(listener);
            };
        }, []),
    };

    return <RenderedContext.Provider value={value}>{children}</RenderedContext.Provider>;
}

export function useRenderedContext() {
    const ctx = useContext(RenderedContext);
    if (!ctx) throw new Error('useRenderedContext must be used within RenderedContextProvider');
    return ctx;
}

/**
 * Hook to get the current rendered summary (reactive).
 */
export function useRenderedSummary(): string {
    const ctx = useRenderedContext();
    return useSyncExternalStore(ctx.subscribe, ctx.getSummary, () => '');
}

const EMPTY_ENTRIES: RenderedEntry[] = [];

/**
 * Hook to get serializable entries (for chat history persistence).
 */
export function useRenderedEntries(): RenderedEntry[] {
    const ctx = useRenderedContext();
    return useSyncExternalStore(ctx.subscribe, ctx.getEntries, () => EMPTY_ENTRIES);
}

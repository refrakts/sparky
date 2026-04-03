'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import type { TokenListResponse } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'iconUrl', label: 'Icon', render: 'icon-url', sortable: false },
    { key: 'name', label: 'Name', render: 'text', sortable: true },
    { key: 'ticker', label: 'Ticker', render: 'text', sortable: true },
    { key: 'holderCount', label: 'Holders', render: 'number', sortable: true },
    { key: 'totalSupply', label: 'Supply', render: 'token-amount', sortable: false },
    { key: 'createdAt', label: 'Created', render: 'timeago', sortable: true },
];

interface TokenListProps {
    limit?: number;
    sort?: 'holders' | 'updated_at' | 'created_at' | 'supply';
    sortDirection?: 'asc' | 'desc';
    hasIcon?: boolean;
    minHolders?: number;
    columns?: InferredColumn[];
}

export function TokenList({
    limit = 25,
    sort = 'updated_at',
    sortDirection = 'desc',
    hasIcon,
    minHolders,
    columns,
}: TokenListProps) {
    const [cursor, setCursor] = useState<string | null>(null);
    const [cursorStack, setCursorStack] = useState<string[]>([]);

    const { data, isLoading } = useQuery({
        queryKey: ['token-list', limit, cursor, sort, sortDirection, hasIcon, minHolders],
        queryFn: () =>
            sparkscanProxyFetch<TokenListResponse>('/v2/tokens/list', {
                limit,
                sort,
                sortDirection,
                ...(cursor ? { cursor } : {}),
                ...(hasIcon !== undefined ? { hasIcon: hasIcon ? 'true' : 'false' } : {}),
                ...(minHolders !== undefined ? { minHolders } : {}),
            }),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const rows = data.tokens
            .slice(0, 10)
            .map((t, i) => `#${i + 1} ${t.name} (${t.ticker}), id=${t.tokenIdentifier}, ${t.holderCount} holders`)
            .join('; ');
        return {
            component: 'TokenList',
            summary: `Token list showing ${data.tokens.length} of ${data.totalTokens} tokens (sorted by ${sort} ${sortDirection}). Rows: ${rows}.`,
            data: { tokens: data.tokens, totalTokens: data.totalTokens },
        };
    }, [data, sort, sortDirection]);

    useReportData(reportEntry);

    const handleNext = () => {
        if (data?.nextCursor) {
            setCursorStack((prev) => [...prev, cursor ?? '']);
            setCursor(data.nextCursor);
        }
    };

    const handlePrev = () => {
        setCursorStack((prev) => {
            const newStack = [...prev];
            const prevCursor = newStack.pop();
            setCursor(prevCursor || null);
            return newStack;
        });
    };

    return (
        <div>
            <DataTable
                data={(data?.tokens ?? []) as unknown as Record<string, unknown>[]}
                columns={columns ?? COLUMNS}
                isLoading={isLoading}
                title="All Tokens"
            />
            <div className="flex items-center justify-between px-2 py-3">
                <p className="text-sm text-muted-foreground">
                    {data?.totalTokens != null ? `${data.totalTokens.toLocaleString()} total tokens` : ''}
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={handlePrev}
                        disabled={cursorStack.length === 0}
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={handleNext}
                        disabled={!data?.nextCursor}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}

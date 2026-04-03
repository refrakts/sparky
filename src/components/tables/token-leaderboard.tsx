'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import type { TokenLeaderboardResponse } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'rank', label: '#', render: 'number', sortable: false },
    { key: 'iconUrl', label: 'Icon', render: 'icon-url', sortable: false },
    { key: 'name', label: 'Name', render: 'text', sortable: true },
    { key: 'ticker', label: 'Ticker', render: 'text', sortable: true },
    { key: 'holderCount', label: 'Holders', render: 'number', sortable: true },
    { key: 'priceUsd', label: 'Price', render: 'usd', sortable: true },
    { key: 'marketCapUsd', label: 'Market Cap', render: 'usd', sortable: true },
];

interface TokenLeaderboardProps {
    limit?: number;
    sort?: 'holders' | 'updated_at';
    columns?: InferredColumn[];
}

export function TokenLeaderboard({ limit = 25, sort = 'holders', columns }: TokenLeaderboardProps) {
    const [offset, setOffset] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['token-leaderboard', limit, offset, sort],
        queryFn: () =>
            sparkscanProxyFetch<TokenLeaderboardResponse>(
                '/internal/mZzU4Db6GgL1Reqs51le0IMSNSiqzU2E/stats/leaderboard/tokens',
                { limit, offset, sort },
            ),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const rows = data.leaderboard
            .slice(0, 10)
            .map(
                (t) =>
                    `#${t.rank} ${t.name} (${t.ticker}): ${t.holderCount} holders, mcap ${t.marketCapUsd ? `$${t.marketCapUsd.toLocaleString()}` : 'N/A'}`,
            )
            .join('; ');
        return {
            component: 'TokenLeaderboard',
            summary: `Token leaderboard showing ${data.leaderboard.length} of ${data.totalTokens} tokens. Rows: ${rows}.`,
            data: { leaderboard: data.leaderboard, totalTokens: data.totalTokens },
        };
    }, [data]);

    useReportData(reportEntry);

    const hasNext = data ? offset + limit < data.totalTokens : false;
    const hasPrev = offset > 0;

    const rows = useMemo(() => {
        if (!data) return [];
        return data.leaderboard.map((t) => {
            const supply = Number(t.totalSupply) / 10 ** t.decimals;
            return { ...t, priceUsd: supply > 0 ? t.marketCapUsd / supply : 0 };
        });
    }, [data]);

    return (
        <div>
            <DataTable
                data={rows as unknown as Record<string, unknown>[]}
                columns={columns ?? COLUMNS}
                isLoading={isLoading}
                title="Top Tokens"
            />
            <div className="flex items-center justify-between px-2 py-3">
                <p className="text-sm text-muted-foreground">
                    {data?.totalTokens != null ? `${data.totalTokens.toLocaleString()} total tokens` : ''}
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={() => setOffset((o) => Math.max(0, o - limit))}
                        disabled={!hasPrev}
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={() => setOffset((o) => o + limit)}
                        disabled={!hasNext}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}

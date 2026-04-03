'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import type { WalletLeaderboard as WalletLeaderboardData } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'rank', label: '#', render: 'number', sortable: false },
    { key: 'sparkAddress', label: 'Address', render: 'address', sortable: false },
    { key: 'totalValueSats', label: 'Value (sats)', render: 'sats', sortable: true },
    { key: 'totalValueUsd', label: 'Value (USD)', render: 'usd', sortable: true },
];

interface WalletLeaderboardProps {
    limit?: number;
    columns?: InferredColumn[];
}

export function WalletLeaderboard({ limit = 25, columns }: WalletLeaderboardProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['wallet-leaderboard', limit],
        queryFn: () =>
            sparkscanProxyFetch<WalletLeaderboardData>(
                '/internal/mZzU4Db6GgL1Reqs51le0IMSNSiqzU2E/stats/leaderboard/wallets',
                { limit },
            ),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const rows = data.leaderboard
            .slice(0, 10)
            .map((w) => `#${w.rank} ${w.sparkAddress.slice(0, 16)}... ($${w.totalValueUsd?.toLocaleString() ?? 'N/A'})`)
            .join('; ');
        return {
            component: 'WalletLeaderboard',
            summary: `Wallet leaderboard showing ${data.leaderboard.length} wallets. Rows: ${rows}.`,
            data: { leaderboard: data.leaderboard },
        };
    }, [data]);

    useReportData(reportEntry);

    return (
        <DataTable
            data={(data?.leaderboard ?? []) as unknown as Record<string, unknown>[]}
            columns={columns ?? COLUMNS}
            isLoading={isLoading}
            title="Top Wallets"
        />
    );
}

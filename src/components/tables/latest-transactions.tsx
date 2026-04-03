'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import type { Transaction } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'id', label: 'Transaction', render: 'txid', sortable: false },
    { key: 'type', label: 'Type', render: 'tx-type-badge', sortable: true },
    { key: 'amountSats', label: 'Amount (sats)', render: 'sats', sortable: true },
    { key: 'valueUsd', label: 'Value (USD)', render: 'usd', sortable: true },
    { key: 'createdAt', label: 'Time', render: 'timeago', sortable: true },
];

interface LatestTransactionsProps {
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    fromTimestamp?: string;
    toTimestamp?: string;
    columns?: InferredColumn[];
}

export function LatestTransactions({
    limit = 25,
    sort = 'created_at',
    order = 'desc',
    fromTimestamp,
    toTimestamp,
    columns,
}: LatestTransactionsProps) {
    const [pageIndex, setPageIndex] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['latest-txs', limit, pageIndex, sort, order, fromTimestamp, toTimestamp],
        queryFn: () =>
            sparkscanProxyFetch<Transaction[]>('/v1/tx/latest', {
                limit,
                offset: pageIndex * limit,
                sort,
                order,
                from_timestamp: fromTimestamp,
                to_timestamp: toTimestamp,
            }),
    });

    // Report a compact summary to the rendered context
    const reportEntry = useMemo(() => {
        if (!data || data.length === 0) return null;
        const types: Record<string, number> = {};
        let totalValueUsd = 0;
        for (const tx of data) {
            types[tx.type] = (types[tx.type] ?? 0) + 1;
            totalValueUsd += tx.valueUsd ?? 0;
        }
        return {
            component: 'LatestTransactions',
            summary: `Showing ${data.length} latest transactions. Types: ${Object.entries(types)
                .map(([t, c]) => `${c} ${t}`)
                .join(', ')}. Total value: $${totalValueUsd.toFixed(2)}.`,
            data: {
                transactions: data.map((tx) => ({
                    id: tx.id,
                    type: tx.type,
                    status: tx.status,
                    from: tx.from?.identifier,
                    to: tx.to?.identifier,
                    amountSats: tx.amountSats,
                    valueUsd: tx.valueUsd,
                    createdAt: tx.createdAt,
                })),
            },
        };
    }, [data]);

    useReportData(reportEntry);

    return (
        <DataTable
            data={(data ?? []) as unknown as Record<string, unknown>[]}
            columns={columns ?? COLUMNS}
            isLoading={isLoading}
            pageSize={limit}
            pageIndex={pageIndex}
            onPageChange={setPageIndex}
            title="Latest Transactions"
            statusKey="status"
        />
    );
}

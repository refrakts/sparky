'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatUsd } from '@/lib/formatters';
import type { AddressTransaction, PaginatedResponse } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'id', label: 'Transaction', render: 'txid', sortable: false },
    { key: 'type', label: 'Type', render: 'tx-type-badge', sortable: true },
    { key: 'direction', label: 'Direction', render: 'direction-badge', sortable: false },
    { key: 'valueUsd', label: 'Value (USD)', render: 'usd', sortable: true },
    { key: 'createdAt', label: 'Time', render: 'timeago', sortable: true },
];

interface AddressTransactionsProps {
    address: string;
    limit?: number;
    asset?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    fromTimestamp?: string;
    toTimestamp?: string;
    columns?: InferredColumn[];
}

export function AddressTransactions({
    address,
    limit = 25,
    asset,
    sort = 'created_at',
    order = 'desc',
    fromTimestamp,
    toTimestamp,
    columns,
}: AddressTransactionsProps) {
    const [pageIndex, setPageIndex] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['address-txs', address, limit, pageIndex, asset, sort, order, fromTimestamp, toTimestamp],
        queryFn: () =>
            sparkscanProxyFetch<PaginatedResponse<AddressTransaction>>(`/v1/address/${address}/transactions`, {
                limit,
                offset: pageIndex * limit,
                asset,
                sort,
                order,
                from_timestamp: fromTimestamp,
                to_timestamp: toTimestamp,
            }),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const types: Record<string, number> = {};
        let totalUsd = 0;
        for (const tx of data.data) {
            types[tx.type] = (types[tx.type] ?? 0) + 1;
            totalUsd += tx.valueUsd ?? 0;
        }
        const typeSummary = Object.entries(types)
            .map(([t, c]) => `${c} ${t}`)
            .join(', ');
        return {
            component: 'AddressTransactions',
            summary: `${data.meta.totalItems} transactions for ${address} (showing ${data.data.length}). Types: ${typeSummary}. Total value: ${formatUsd(totalUsd)}.`,
            data: { transactions: data.data, totalItems: data.meta.totalItems },
        };
    }, [data, address]);

    useReportData(reportEntry);

    return (
        <DataTable
            data={(data?.data ?? []) as unknown as Record<string, unknown>[]}
            columns={columns ?? COLUMNS}
            isLoading={isLoading}
            pageSize={limit}
            pageIndex={pageIndex}
            onPageChange={setPageIndex}
            totalItems={data?.meta?.totalItems}
            title="Address Transactions"
            statusKey="status"
        />
    );
}

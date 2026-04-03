'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import type { PaginatedResponse, Transaction } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'id', label: 'Transaction', render: 'txid', sortable: false },
    { key: 'type', label: 'Type', render: 'tx-type-badge', sortable: true },
    { key: 'createdAt', label: 'Time', render: 'timeago', sortable: true },
];

interface TokenTransactionsProps {
    identifier: string;
    limit?: number;
    columns?: InferredColumn[];
}

export function TokenTransactions({ identifier, limit = 25, columns }: TokenTransactionsProps) {
    const [pageIndex, setPageIndex] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['token-txs', identifier, limit, pageIndex],
        queryFn: () =>
            sparkscanProxyFetch<PaginatedResponse<Transaction>>(`/v1/tokens/${identifier}/transactions`, {
                limit,
                offset: pageIndex * limit,
            }),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        return {
            component: 'TokenTransactions',
            summary: `${data.meta.totalItems} transactions for token ${identifier} (showing ${data.data.length}).`,
            data: { transactions: data.data.slice(0, 5), totalItems: data.meta.totalItems },
        };
    }, [data, identifier]);

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
            title="Token Transactions"
            statusKey="status"
        />
    );
}

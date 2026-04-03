'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import type { PaginatedResponse, TokenHolder } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'address', label: 'Address', render: 'address', sortable: false },
    { key: 'balance', label: 'Balance', render: 'token-amount', sortable: true },
    { key: 'valueUsd', label: 'Value (USD)', render: 'usd', sortable: true },
    { key: 'percentage', label: '% Supply', render: 'percent', sortable: true },
];

interface TokenHoldersProps {
    identifier: string;
    limit?: number;
    columns?: InferredColumn[];
}

export function TokenHolders({ identifier, limit = 25, columns }: TokenHoldersProps) {
    const [pageIndex, setPageIndex] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['token-holders', identifier, limit, pageIndex],
        queryFn: () =>
            sparkscanProxyFetch<PaginatedResponse<TokenHolder>>(`/v1/tokens/${identifier}/holders`, {
                limit,
                offset: pageIndex * limit,
            }),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const rows = data.data
            .slice(0, 10)
            .map(
                (h, i) =>
                    `#${i + 1} ${h.address.slice(0, 16)}... (${h.percentage.toFixed(1)}%, $${h.valueUsd.toLocaleString()})`,
            )
            .join('; ');
        return {
            component: 'TokenHolders',
            summary: `Token holders for ${identifier}: ${data.meta.totalItems} total. Top: ${rows}.`,
            data: { holders: data.data, totalItems: data.meta.totalItems },
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
            title="Token Holders"
        />
    );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatUsd } from '@/lib/formatters';
import type { AddressTokensResponse } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'iconUrl', label: 'Icon', render: 'icon-url', sortable: false },
    { key: 'name', label: 'Name', render: 'text', sortable: true },
    { key: 'ticker', label: 'Ticker', render: 'text', sortable: true },
    { key: 'balance', label: 'Balance', render: 'token-amount', sortable: true },
    { key: 'valueUsd', label: 'Value (USD)', render: 'usd', sortable: true },
];

interface AddressTokensProps {
    address: string;
    columns?: InferredColumn[];
}

export function AddressTokens({ address, columns }: AddressTokensProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['address-tokens', address],
        queryFn: () => sparkscanProxyFetch<AddressTokensResponse>(`/v1/address/${address}/tokens`),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const rows = data.tokens
            .slice(0, 10)
            .map((t) => `${t.name} (${t.ticker}), id=${t.tokenIdentifier}, ${formatUsd(t.valueUsd)}`)
            .join('; ');
        return {
            component: 'AddressTokens',
            summary: `${address} holds ${data.tokenCount} tokens (${formatUsd(data.totalTokenValueUsd)} total). Tokens: ${rows}.`,
            data: { tokens: data.tokens, tokenCount: data.tokenCount },
        };
    }, [data, address]);

    useReportData(reportEntry);

    return (
        <DataTable
            data={(data?.tokens ?? []) as unknown as Record<string, unknown>[]}
            columns={columns ?? COLUMNS}
            isLoading={isLoading}
            title="Token Holdings"
        />
    );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { flashnetProxyFetch } from '@/lib/api';
import type { FlashnetPoolsResponse } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import type { InferredColumn } from './column-inference';
import { DataTable } from './data-table';

const COLUMNS: InferredColumn[] = [
    { key: 'hostName', label: 'Host', render: 'text', sortable: true },
    { key: 'assetAAddress', label: 'Asset A', render: 'address', sortable: false },
    { key: 'curveType', label: 'Type', render: 'curve-type', sortable: true },
    { key: 'tvlAssetB', label: 'TVL', render: 'compact-number', sortable: true },
    { key: 'volume24hAssetB', label: '24h Volume', render: 'compact-number', sortable: true },
    { key: 'currentPriceAInB', label: 'Price', render: 'pool-price', sortable: true },
    { key: 'priceChangePercent24h', label: '24h Change', render: 'change-percent', sortable: true },
    { key: 'lpFeeBps', label: 'LP Fee (bps)', render: 'number', sortable: true },
    { key: 'hostFeeBps', label: 'Host Fee (bps)', render: 'number', sortable: true },
    { key: 'createdAt', label: 'Created', render: 'timeago', sortable: true },
];

interface FlashnetPoolsProps {
    limit?: number;
    offset?: number;
    sort?: string;
    minVolume24h?: number;
    minTvl?: number;
    curveTypes?: string[];
    hostNames?: string[];
    columns?: InferredColumn[];
}

export function FlashnetPools({
    limit = 25,
    offset: initialOffset,
    sort = 'tvlAssetB:desc',
    minVolume24h,
    minTvl,
    curveTypes,
    hostNames,
    columns,
}: FlashnetPoolsProps) {
    const [pageIndex, setPageIndex] = useState(0);
    const currentOffset = initialOffset ?? pageIndex * limit;

    const { data, isLoading } = useQuery({
        queryKey: ['flashnet-pools', limit, currentOffset, sort, minVolume24h, minTvl, curveTypes, hostNames],
        queryFn: () =>
            flashnetProxyFetch<FlashnetPoolsResponse>('/v1/pools', {
                limit,
                offset: currentOffset,
                ...(sort ? { sort } : {}),
                ...(minVolume24h !== undefined ? { minVolume24h } : {}),
                ...(minTvl !== undefined ? { minTvl } : {}),
                ...(curveTypes?.length ? { curveTypes: curveTypes.join(',') } : {}),
                ...(hostNames?.length ? { hostNames: hostNames.join(',') } : {}),
            }),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const rows = data.pools
            .slice(0, 5)
            .map((p) => `${p.hostName}: ${p.curveType}, TVL ${p.tvlAssetB}, vol24h ${p.volume24hAssetB}`)
            .join('; ');
        return {
            component: 'FlashnetPools',
            summary: `${data.totalCount} Flashnet pools. Top: ${rows}.`,
            data: { pools: data.pools.slice(0, 10), totalCount: data.totalCount },
        };
    }, [data]);

    useReportData(reportEntry);

    return (
        <DataTable
            data={(data?.pools ?? []) as unknown as Record<string, unknown>[]}
            columns={columns ?? COLUMNS}
            isLoading={isLoading}
            title="Flashnet AMM Pools"
            totalItems={data?.totalCount}
            pageSize={limit}
            pageIndex={pageIndex}
            onPageChange={setPageIndex}
        />
    );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { flashnetProxyFetch } from '@/lib/api';
import { formatTimeago, truncateAddress } from '@/lib/formatters';
import type { FlashnetPoolsResponse } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';

interface FlashnetPoolDetailProps {
    poolId: string;
}

export function FlashnetPoolDetail({ poolId }: FlashnetPoolDetailProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['flashnet-pool-detail', poolId],
        queryFn: async () => {
            const res = await flashnetProxyFetch<FlashnetPoolsResponse>('/v1/pools', {
                limit: 100,
            });
            const pool = res.pools.find((p) => p.lpPublicKey === poolId);
            if (!pool) throw new Error('Pool not found');
            return pool;
        },
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        return {
            component: 'FlashnetPoolDetail',
            summary: `Flashnet pool ${data.lpPublicKey.slice(0, 12)}...: ${data.curveType} on ${data.hostName}, TVL ${data.tvlAssetB}, vol24h ${data.volume24hAssetB}, price ${data.currentPriceAInB}.`,
            data: { ...data },
        };
    }, [data]);

    useReportData(reportEntry);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return <p className="text-sm text-muted-foreground">Failed to load pool details</p>;
    }

    const curveColor =
        data.curveType === 'CONSTANT_PRODUCT'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';

    const priceChange = parseFloat(data.priceChangePercent24h);
    const priceChangeColor =
        priceChange > 0
            ? 'text-green-600 dark:text-green-400'
            : priceChange < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    Flashnet Pool
                    <Badge variant="secondary" className={curveColor}>
                        {data.curveType.replace('_', ' ')}
                    </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground font-mono">{truncateAddress(data.lpPublicKey, 12, 8)}</p>
            </CardHeader>
            <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                        <dt className="text-muted-foreground">Host</dt>
                        <dd className="font-medium">{data.hostName}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Price (A in B)</dt>
                        <dd className="font-medium tabular-nums">{data.currentPriceAInB}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">24h Price Change</dt>
                        <dd className={`font-medium tabular-nums ${priceChangeColor}`}>
                            {priceChange > 0 ? '+' : ''}
                            {data.priceChangePercent24h}%
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">TVL (Asset B)</dt>
                        <dd className="font-medium tabular-nums">{data.tvlAssetB}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">24h Volume</dt>
                        <dd className="font-medium tabular-nums">{data.volume24hAssetB}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Asset A Reserve</dt>
                        <dd className="font-medium tabular-nums">{data.assetAReserve}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Asset B Reserve</dt>
                        <dd className="font-medium tabular-nums">{data.assetBReserve}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Asset A</dt>
                        <dd className="font-mono text-xs">{truncateAddress(data.assetAAddress)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Asset B</dt>
                        <dd className="font-mono text-xs">{truncateAddress(data.assetBAddress)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">LP Fee</dt>
                        <dd className="font-medium">{data.lpFeeBps} bps</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Host Fee</dt>
                        <dd className="font-medium">{data.hostFeeBps} bps</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="text-muted-foreground">{formatTimeago(data.createdAt)}</dd>
                    </div>
                    {data.bondingProgressPercent && (
                        <div>
                            <dt className="text-muted-foreground">Bonding Progress</dt>
                            <dd className="font-medium tabular-nums">{data.bondingProgressPercent}%</dd>
                        </div>
                    )}
                </dl>
            </CardContent>
        </Card>
    );
}

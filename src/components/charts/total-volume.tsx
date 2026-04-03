'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatUsd } from '@/lib/formatters';
import type { TotalPlatformVolume as TPVData } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';

interface TotalPlatformVolumeProps {
    chartType?: 'area' | 'line' | 'bar';
    title?: string;
}

export function TotalPlatformVolume({ title = 'Total Platform Volume' }: TotalPlatformVolumeProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['tpv'],
        queryFn: () => sparkscanProxyFetch<TPVData>('/v2/stats/tpv'),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        return {
            component: 'TotalPlatformVolume',
            summary: `Total platform volume: ${formatUsd(data.tpvUsd)} (${data.tpvSats.toLocaleString()} sats), period ${data.period}.`,
            data: { tpvUsd: data.tpvUsd, tpvSats: data.tpvSats, period: data.period },
        };
    }, [data]);

    useReportData(reportEntry);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[100px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Failed to load volume data</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>
                    {data.period} period ({new Date(data.startTime).toLocaleDateString()} –{' '}
                    {new Date(data.endTime).toLocaleDateString()})
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Volume (USD)</p>
                        <p className="truncate text-2xl font-semibold tabular-nums">{formatUsd(data.tpvUsd)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Volume (sats)</p>
                        <p className="truncate text-2xl font-semibold tabular-nums">
                            {data.tpvSats.toLocaleString()} sats
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

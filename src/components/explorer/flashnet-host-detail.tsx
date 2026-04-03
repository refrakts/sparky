'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { flashnetProxyFetch } from '@/lib/api';
import { formatTimeago, truncateAddress } from '@/lib/formatters';
import type { FlashnetHost } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';

interface FlashnetHostDetailProps {
    namespace: string;
}

export function FlashnetHostDetail({ namespace }: FlashnetHostDetailProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['flashnet-host', namespace],
        queryFn: () => flashnetProxyFetch<FlashnetHost>(`/v1/hosts/${encodeURIComponent(namespace)}`),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        return {
            component: 'FlashnetHostDetail',
            summary: `Flashnet host ${data.namespace}: min fee ${data.minFeeBps}bps, fee recipient ${data.feeRecipientPublicKey.slice(0, 12)}..., created ${data.createdAt}.`,
            data: { ...data },
        };
    }, [data]);

    useReportData(reportEntry);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return <p className="text-sm text-muted-foreground">Failed to load host details</p>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Flashnet Host: {data.namespace}</CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                        <dt className="text-muted-foreground">Namespace</dt>
                        <dd className="font-medium">{data.namespace}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Min Fee</dt>
                        <dd className="font-medium">{data.minFeeBps} bps</dd>
                    </div>
                    <div className="col-span-2">
                        <dt className="text-muted-foreground">Fee Recipient</dt>
                        <dd className="font-mono text-xs">{truncateAddress(data.feeRecipientPublicKey, 12, 8)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="text-muted-foreground">{formatTimeago(data.createdAt)}</dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}

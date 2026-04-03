'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatNumber, formatTimeago, formatTokenAmount, formatUsd } from '@/lib/formatters';
import type { TokenDetail as TokenDetailData } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';

interface TokenDetailProps {
    identifier: string;
}

export function TokenDetail({ identifier }: TokenDetailProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['token', identifier],
        queryFn: async () => {
            const result = await sparkscanProxyFetch<TokenDetailData | Record<string, unknown>[]>(
                `/v1/tokens/${identifier}`,
            );
            if (Array.isArray(result)) {
                const first = result[0] as Record<string, unknown> | undefined;
                if (!first?.tokenIdentifier) return null;
                return sparkscanProxyFetch<TokenDetailData>(`/v1/tokens/${first.tokenIdentifier}`);
            }
            return result;
        },
    });

    const reportEntry = useMemo(() => {
        if (!data?.metadata) return null;
        const m = data.metadata;
        const s = Number(data.totalSupply) / 10 ** m.decimals;
        const price = s > 0 ? data.marketCapUsd / s : 0;
        return {
            component: 'TokenDetail',
            summary: `Token ${m.name} (${m.ticker}), id=${m.tokenIdentifier}: price ${formatUsd(price)}, mcap ${formatUsd(data.marketCapUsd)}, vol24h ${formatUsd(data.volume24hUsd)}, ${m.holderCount} holders, supply ${data.totalSupply}.`,
            data: {
                metadata: m,
                totalSupply: data.totalSupply,
                marketCapUsd: data.marketCapUsd,
                volume24hUsd: data.volume24hUsd,
            },
        };
    }, [data]);

    useReportData(reportEntry);

    if (isLoading) {
        return <TokenDetailSkeleton />;
    }

    if (error || !data?.metadata) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">
                        {error ? `Failed to load token: ${error.message}` : 'Token not found'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { metadata } = data;
    const supply = Number(data.totalSupply) / 10 ** metadata.decimals;
    const derivedPrice = supply > 0 ? data.marketCapUsd / supply : 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    {metadata.iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={metadata.iconUrl}
                            alt={metadata.name}
                            className="h-8 w-8 rounded-full"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    )}
                    <div>
                        <CardTitle>{metadata.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            <span>{metadata.ticker}</span>
                            {metadata.isFreezable && (
                                <Badge variant="outline" className="text-xs">
                                    Freezable
                                </Badge>
                            )}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <StatItem label="Price" value={formatUsd(derivedPrice)} />
                    <StatItem label="Market Cap" value={formatUsd(data.marketCapUsd)} />
                    <StatItem label="24h Volume" value={formatUsd(data.volume24hUsd)} />
                    <StatItem
                        label="Total Supply"
                        value={formatTokenAmount(data.totalSupply, metadata.decimals, metadata.ticker)}
                    />
                    <StatItem label="Holders" value={formatNumber(metadata.holderCount)} />
                    <StatItem label="Decimals" value={String(metadata.decimals)} />
                </div>

                {metadata.maxSupply && metadata.maxSupply !== '0' && (
                    <div className="mt-4">
                        <p className="text-xs text-muted-foreground">Max Supply</p>
                        <p className="text-sm tabular-nums">
                            {formatTokenAmount(metadata.maxSupply, metadata.decimals, metadata.ticker)}
                        </p>
                    </div>
                )}

                {metadata.createdAt && (
                    <p className="mt-4 text-xs text-muted-foreground">Created {formatTimeago(metadata.createdAt)}</p>
                )}
            </CardContent>
        </Card>
    );
}

function StatItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium tabular-nums">{value}</p>
        </div>
    );
}

function TokenDetailSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i}>
                            <Skeleton className="mb-1 h-3 w-16" />
                            <Skeleton className="h-5 w-24" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

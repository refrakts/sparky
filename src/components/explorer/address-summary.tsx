'use client';

import { useMemo } from 'react';
import { AddressCell } from '@/components/tables/cell-renderers';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatNumber, formatSats, formatUsd } from '@/lib/formatters';
import type { AddressSummaryData } from '@/lib/types';
import { useCachedQuery } from '@/lib/use-cached-query';
import { useReportData } from '@/lib/use-report-data';

interface AddressSummaryProps {
    address: string;
}

export function AddressSummary({ address }: AddressSummaryProps) {
    const { data, isLoading, error } = useCachedQuery<AddressSummaryData>('getAddress', {
        queryKey: ['address', address],
        queryFn: () => sparkscanProxyFetch<AddressSummaryData>(`/v1/address/${address}`),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        return {
            component: 'AddressSummary',
            summary: `Address ${data.sparkAddress}: BTC balance ${data.balance.btcSoftBalanceSats} sats ($${data.balance.btcValueUsdSoft.toFixed(2)}), ${data.tokenCount} tokens worth $${data.balance.totalTokenValueUsd.toFixed(2)}, total $${data.totalValueUsd.toFixed(2)}, ${data.transactionCount} txs.`,
            data: {
                sparkAddress: data.sparkAddress,
                publicKey: data.publicKey,
                btcBalanceSats: data.balance.btcSoftBalanceSats,
                btcValueUsd: data.balance.btcValueUsdSoft,
                tokenValueUsd: data.balance.totalTokenValueUsd,
                totalValueUsd: data.totalValueUsd,
                transactionCount: data.transactionCount,
                tokenCount: data.tokenCount,
                tokens: data.tokens?.map((t) => ({
                    ticker: t.ticker,
                    name: t.name,
                    balance: t.balance,
                    valueUsd: t.valueUsd,
                })),
            },
        };
    }, [data]);

    useReportData(reportEntry);

    if (isLoading) {
        return <AddressSummarySkeleton />;
    }

    if (error || !data) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">
                        {error ? `Failed to load address: ${error.message}` : 'Address not found'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const btcBalance = data.balance.btcSoftBalanceSats;
    const btcValueUsd = data.balance.btcValueUsdSoft;
    const tokenValueUsd = data.balance.totalTokenValueUsd;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Address Summary</CardTitle>
                <CardDescription>
                    <AddressCell value={data.sparkAddress} />
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <StatItem label="BTC Balance" value={formatSats(btcBalance)} />
                    <StatItem label="BTC Value" value={formatUsd(btcValueUsd)} />
                    <StatItem label="Token Value" value={formatUsd(tokenValueUsd)} />
                    <StatItem label="Total Value" value={formatUsd(data.totalValueUsd)} highlight />
                </div>

                <div className="mt-4 flex gap-3">
                    <Badge variant="secondary">{formatNumber(data.transactionCount)} txs</Badge>
                    <Badge variant="secondary">{formatNumber(data.tokenCount)} tokens</Badge>
                </div>

                {data.tokens && data.tokens.length > 0 && (
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Token Holdings</p>
                        <div className="space-y-1">
                            {data.tokens.slice(0, 5).map((token) => (
                                <div key={token.tokenIdentifier} className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{token.ticker || token.name}</span>
                                    <span className="tabular-nums text-muted-foreground">
                                        {formatUsd(token.valueUsd)}
                                    </span>
                                </div>
                            ))}
                            {data.tokens.length > 5 && (
                                <p className="text-xs text-muted-foreground">+{data.tokens.length - 5} more</p>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-sm font-medium tabular-nums ${highlight ? 'text-foreground' : ''}`}>{value}</p>
        </div>
    );
}

function AddressSummarySkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
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

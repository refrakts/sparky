'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import type { TokenMetadata } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';

interface TokenSearchProps {
    query: string;
    limit?: number;
}

export function TokenSearch({ query, limit = 10 }: TokenSearchProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['token-search', query, limit],
        queryFn: () =>
            sparkscanProxyFetch<TokenMetadata[]>(`/v1/tokens/${encodeURIComponent(query)}`, {
                limit,
            }),
    });

    const tokens = data ? (Array.isArray(data) ? data : [data]) : null;

    const reportEntry = useMemo(() => {
        if (!tokens) return null;
        const rows = tokens
            .slice(0, 10)
            .map((t) => `${t.name} (${t.ticker}), id=${t.tokenIdentifier}`)
            .join('; ');
        return {
            component: 'TokenSearch',
            summary: `Search "${query}": found ${tokens.length} tokens. Results: ${rows}.`,
            data: { tokens, query },
        };
    }, [tokens, query]);

    useReportData(reportEntry);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-36" />
                </CardHeader>
                <CardContent className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (error || !data || !tokens) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">No tokens found for &quot;{query}&quot;</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Token Search: &quot;{query}&quot;</CardTitle>
            </CardHeader>
            <CardContent>
                {tokens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tokens found</p>
                ) : (
                    <div className="space-y-2">
                        {tokens.map((token) => (
                            <div
                                key={token.tokenIdentifier}
                                className="flex items-center justify-between rounded-md border p-3"
                            >
                                <div className="flex items-center gap-3">
                                    {token.iconUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={token.iconUrl}
                                            alt={token.name}
                                            className="h-6 w-6 rounded-full"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium">{token.name}</p>
                                        <p className="text-xs text-muted-foreground">{token.ticker}</p>
                                    </div>
                                </div>
                                <p className="font-mono text-xs text-muted-foreground">
                                    {token.tokenAddress.slice(0, 12)}...
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

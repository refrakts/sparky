'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AddressCell, StatusBadge, TokenAmountCell, TxidCell, TxTypeBadge } from '@/components/tables/cell-renderers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatDate, formatSats, formatTimeago, formatUsd, txTypeLabel } from '@/lib/formatters';
import type { Transaction } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';

interface TransactionDetailProps {
    txid: string;
}

export function TransactionDetail({ txid }: TransactionDetailProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['transaction', txid],
        queryFn: () => sparkscanProxyFetch<Transaction>(`/v1/tx/${txid}`),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        return {
            component: 'TransactionDetail',
            summary: `Tx ${data.id}: ${data.type} (${data.status}), from ${data.from?.identifier ?? 'unknown'} to ${data.to?.identifier ?? 'unknown'}, ${data.amountSats != null ? `${data.amountSats} sats` : ''} ${data.valueUsd != null ? formatUsd(data.valueUsd) : ''}, ${formatTimeago(data.createdAt)}.`,
            data: { ...data },
        };
    }, [data]);

    useReportData(reportEntry);

    if (isLoading) {
        return <TransactionDetailSkeleton />;
    }

    if (error || !data) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">
                        {error ? `Failed to load transaction: ${error.message}` : 'Transaction not found'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const isTokenTx = !!data.tokenMetadata;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Transaction Detail
                    <TxTypeBadge value={data.type} />
                    <StatusBadge value={data.status} />
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Row label="Transaction ID">
                    <TxidCell value={data.id} />
                </Row>
                <Row label="Type">{txTypeLabel(data.type)}</Row>
                <Row label="Status">{data.status}</Row>

                {data.from && (
                    <Row label="From">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground capitalize">{data.from.type}</span>
                            {data.from.identifier && <AddressCell value={data.from.identifier} />}
                        </div>
                    </Row>
                )}

                {data.to && (
                    <Row label="To">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground capitalize">{data.to.type}</span>
                            {data.to.identifier && <AddressCell value={data.to.identifier} />}
                        </div>
                    </Row>
                )}

                {data.amountSats != null && <Row label="Amount">{formatSats(data.amountSats)}</Row>}

                {isTokenTx && data.amount && data.tokenMetadata && (
                    <Row label="Token Amount">
                        <TokenAmountCell
                            value={data.amount}
                            decimals={data.tokenMetadata.decimals}
                            ticker={data.tokenMetadata.ticker}
                        />
                    </Row>
                )}

                {data.valueUsd != null && <Row label="Value (USD)">{formatUsd(data.valueUsd)}</Row>}

                <Row label="Time">
                    {formatTimeago(data.createdAt)} ({formatDate(data.createdAt)})
                </Row>

                {data.bitcoinTxData && (
                    <>
                        <div className="border-t pt-4">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">Bitcoin Transaction</p>
                        </div>
                        <Row label="BTC Txid">
                            <TxidCell value={data.bitcoinTxData.txid} />
                        </Row>
                        <Row label="Fee">{formatSats(data.bitcoinTxData.fee)}</Row>
                        {data.bitcoinTxData.block && (
                            <Row label="Block Height">{data.bitcoinTxData.block.height.toLocaleString()}</Row>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
            <span className="text-sm">{children}</span>
        </div>
    );
}

function TransactionDetailSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { type Edge, MarkerType, type Node, Position, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import { sparkscanProxyFetch } from '@/lib/api';
import type { Transaction } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTokenAmount, truncateAddress } from '@/lib/formatters';

interface TransactionFlowProps {
    txid: string;
}

export function TransactionFlow({ txid }: TransactionFlowProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['transaction-flow', txid],
        queryFn: () => sparkscanProxyFetch<Transaction>(`/v1/tx/${txid}`),
    });

    const reportEntry = useMemo(() => {
        if (!data?.multiIoDetails) return null;
        return {
            component: 'TransactionFlow',
            summary: `Transaction flow for ${txid}: ${data.multiIoDetails.inputs.length} inputs, ${data.multiIoDetails.outputs.length} outputs, token ${data.tokenMetadata?.ticker ?? 'unknown'}.`,
            data: { txid, inputs: data.multiIoDetails.inputs.length, outputs: data.multiIoDetails.outputs.length },
        };
    }, [data, txid]);

    useReportData(reportEntry);

    const { nodes, edges } = useMemo(() => {
        if (!data?.multiIoDetails) return { nodes: [], edges: [] };

        const { inputs, outputs } = data.multiIoDetails;
        const decimals = data.tokenMetadata?.decimals ?? 8;
        const ticker = data.tokenMetadata?.ticker;

        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];

        // Input nodes on the left
        inputs.forEach((input, i) => {
            const nodeId = `input-${i}`;
            flowNodes.push({
                id: nodeId,
                position: { x: 0, y: i * 100 },
                data: {
                    label: (
                        <div className="rounded-md border bg-card p-2 text-xs shadow-sm">
                            <p className="font-mono">{truncateAddress(input.address)}</p>
                            <p className="mt-1 tabular-nums text-muted-foreground">
                                {formatTokenAmount(input.amount, decimals, ticker)}
                            </p>
                        </div>
                    ),
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
                type: 'default',
            });

            flowEdges.push({
                id: `edge-in-${i}`,
                source: nodeId,
                target: 'tx-center',
                animated: true,
                label: formatTokenAmount(input.amount, decimals),
                style: { stroke: 'var(--chart-1)' },
                markerEnd: { type: MarkerType.ArrowClosed },
            });
        });

        // Center transaction node
        flowNodes.push({
            id: 'tx-center',
            position: {
                x: 300,
                y: Math.max(inputs.length, outputs.length) * 50 - 30,
            },
            data: {
                label: (
                    <div className="rounded-md border-2 border-primary bg-card p-3 text-xs shadow-md">
                        <p className="font-medium">Transaction</p>
                        <p className="mt-1 font-mono text-muted-foreground">{txid.slice(0, 8)}...</p>
                    </div>
                ),
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            type: 'default',
        });

        // Output nodes on the right
        outputs.forEach((output, i) => {
            const nodeId = `output-${i}`;
            flowNodes.push({
                id: nodeId,
                position: { x: 600, y: i * 100 },
                data: {
                    label: (
                        <div className="rounded-md border bg-card p-2 text-xs shadow-sm">
                            <p className="font-mono">{truncateAddress(output.address)}</p>
                            <p className="mt-1 tabular-nums text-muted-foreground">
                                {formatTokenAmount(output.amount, decimals, ticker)}
                            </p>
                        </div>
                    ),
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
                type: 'default',
            });

            flowEdges.push({
                id: `edge-out-${i}`,
                source: 'tx-center',
                target: nodeId,
                animated: true,
                label: formatTokenAmount(output.amount, decimals),
                style: { stroke: 'var(--chart-2)' },
                markerEnd: { type: MarkerType.ArrowClosed },
            });
        });

        return { nodes: flowNodes, edges: flowEdges };
    }, [data, txid]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Transaction Flow</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">Failed to load transaction</p>
                </CardContent>
            </Card>
        );
    }

    if (!data.multiIoDetails) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">
                        This transaction does not have multi-IO details. Transaction Flow is only available for
                        token_multi_transfer transactions.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transaction Flow</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        fitView
                        proOptions={{ hideAttribution: true }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

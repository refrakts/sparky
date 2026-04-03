'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import { useReportData } from '@/lib/use-report-data';

interface BalanceHistoryChartProps {
    address: string;
    chartType?: 'line' | 'area';
    title?: string;
}

const chartConfig: ChartConfig = {
    balance: {
        label: 'Balance (sats)',
        color: 'var(--chart-1)',
    },
};

export function BalanceHistoryChart({
    address,
    chartType = 'area',
    title = 'Balance History',
}: BalanceHistoryChartProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['balance-history', address],
        queryFn: () =>
            sparkscanProxyFetch<{ data: Array<{ t: number; b: string }> }>(`/v2/historical/sats/balances/${address}`),
    });

    const points = data?.data;

    const reportEntry = useMemo(() => {
        if (!points) return null;
        const latest = Number(points[points.length - 1]?.b ?? 0);
        return {
            component: 'BalanceHistoryChart',
            summary: `Balance history for ${address}: ${points.length} data points, latest balance ${latest.toLocaleString()} sats.`,
            data: { address, dataPoints: points.length, latestBalance: latest },
        };
    }, [points, address]);

    useReportData(reportEntry);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[200px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error || !points || points.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No balance history available</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = points.map((d) => ({
        date: new Date(d.t).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        }),
        balance: Number(d.b),
    }));

    const ChartType = chartType === 'line' ? LineChart : AreaChart;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <ChartType data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => `${(v / 1e8).toFixed(2)}`}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {chartType === 'area' ? (
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="var(--color-balance)"
                                fill="var(--color-balance)"
                                fillOpacity={0.2}
                            />
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="balance"
                                stroke="var(--color-balance)"
                                strokeWidth={2}
                                dot={false}
                            />
                        )}
                    </ChartType>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

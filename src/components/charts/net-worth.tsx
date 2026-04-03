'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatUsd } from '@/lib/formatters';
import { useReportData } from '@/lib/use-report-data';

interface NetWorthChartProps {
    address: string;
    chartType?: 'line' | 'area';
    title?: string;
}

const chartConfig: ChartConfig = {
    netWorth: {
        label: 'Net Worth (USD)',
        color: 'var(--chart-3)',
    },
};

export function NetWorthChart({ address, chartType = 'area', title = 'Net Worth History' }: NetWorthChartProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['net-worth', address],
        queryFn: () =>
            sparkscanProxyFetch<{ data: Array<{ t: number; nw: string }> }>(`/v2/historical/net-worth/${address}`),
    });

    const points = data?.data;

    const reportEntry = useMemo(() => {
        if (!points) return null;
        const latest = Number(points[points.length - 1]?.nw ?? 0);
        return {
            component: 'NetWorthChart',
            summary: `Net worth history for ${address}: ${points.length} data points, latest ${formatUsd(latest)}.`,
            data: { address, dataPoints: points.length, latestNetWorth: latest },
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
                    <p className="text-sm text-muted-foreground">No net worth history available</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = points.map((d) => ({
        date: new Date(d.t).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        }),
        netWorth: Number(d.nw),
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
                            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {chartType === 'area' ? (
                            <Area
                                type="monotone"
                                dataKey="netWorth"
                                stroke="var(--color-netWorth)"
                                fill="var(--color-netWorth)"
                                fillOpacity={0.2}
                            />
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="netWorth"
                                stroke="var(--color-netWorth)"
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

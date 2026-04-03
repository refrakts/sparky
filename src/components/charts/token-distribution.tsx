'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { sparkscanProxyFetch } from '@/lib/api';
import { formatUsd } from '@/lib/formatters';
import type { AddressTokensResponse } from '@/lib/types';
import { useReportData } from '@/lib/use-report-data';

interface TokenDistributionChartProps {
    address: string;
    chartType?: 'pie' | 'bar' | 'donut';
    metric?: 'valueUsd' | 'balance';
    title?: string;
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function TokenDistributionChart({
    address,
    chartType = 'pie',
    metric = 'valueUsd',
    title = 'Token Distribution',
}: TokenDistributionChartProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['address-tokens-chart', address],
        queryFn: () => sparkscanProxyFetch<AddressTokensResponse>(`/v1/address/${address}/tokens`),
    });

    const reportEntry = useMemo(() => {
        if (!data) return null;
        const top = data.tokens
            .slice(0, 5)
            .map((t) => `${t.ticker} (${formatUsd(t.valueUsd)})`)
            .join(', ');
        return {
            component: 'TokenDistributionChart',
            summary: `Token distribution for ${address}: ${data.tokens.length} tokens, total ${formatUsd(data.totalTokenValueUsd)}. Top: ${top}.`,
            data: { address, tokens: data.tokens.slice(0, 10) },
        };
    }, [data, address]);

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

    if (error || !data || data.tokens.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No token data available</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = data.tokens
        .slice(0, 10)
        .map((t) => ({
            name: t.ticker || t.name,
            value: metric === 'valueUsd' ? t.valueUsd : Number(t.balance),
        }))
        .filter((d) => d.value > 0);

    const chartConfig: ChartConfig = Object.fromEntries(
        chartData.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }]),
    );

    if (chartType === 'bar') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="value" radius={4}>
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        );
    }

    // Pie or Donut
    const innerRadius = chartType === 'donut' ? 60 : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={innerRadius}
                            outerRadius={80}
                        >
                            {chartData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

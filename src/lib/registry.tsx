'use client';

import { defineRegistry } from '@json-render/react';
import { motion } from 'motion/react';
// Chart components
import { BalanceHistoryChart } from '@/components/charts/balance-history';
import { NetWorthChart } from '@/components/charts/net-worth';
import { TokenBalanceChart } from '@/components/charts/token-balance';
import { TokenDistributionChart } from '@/components/charts/token-distribution';
import { TotalPlatformVolume } from '@/components/charts/total-volume';
// Explorer components
import { AddressSummary } from '@/components/explorer/address-summary';
import { FlashnetHostDetail } from '@/components/explorer/flashnet-host-detail';
import { FlashnetPoolDetail } from '@/components/explorer/flashnet-pool-detail';
import { TokenDetail } from '@/components/explorer/token-detail';
import { TokenSearch } from '@/components/explorer/token-search';
import { TransactionDetail } from '@/components/explorer/transaction-detail';
import { TransactionFlow } from '@/components/explorer/transaction-flow';
import { AddressTokens } from '@/components/tables/address-tokens';
import { AddressTransactions } from '@/components/tables/address-transactions';
// Flashnet components
import { FlashnetPools } from '@/components/tables/flashnet-pools';
// Table components
import { LatestTransactions } from '@/components/tables/latest-transactions';
import { TokenHolders } from '@/components/tables/token-holders';
import { TokenLeaderboard } from '@/components/tables/token-leaderboard';
import { TokenList } from '@/components/tables/token-list';
import { TokenTransactions } from '@/components/tables/token-transactions';
import { WalletLeaderboard } from '@/components/tables/wallet-leaderboard';
// shadcn
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { catalog } from './catalog';

export const { registry } = defineRegistry(catalog, {
    components: {
        // ── Layout Primitives ──────────────────────────────────────────
        // Inline styles for AI-controlled layout (avoids Tailwind purge)
        Grid: ({ props, children }) => (
            <div
                className="sparky-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
                    gap: `${(props.gap ?? 4) * 4}px`,
                }}
            >
                {children}
            </div>
        ),

        GridItem: ({ props, children }) => (
            <motion.div
                layout
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="sparky-grid-item"
                style={{ gridColumn: `span ${props.colSpan}` }}
            >
                {children}
            </motion.div>
        ),

        Card: ({ props, children }) => (
            <Card>
                {(props.title || props.description) && (
                    <CardHeader>
                        {props.title && <CardTitle>{props.title}</CardTitle>}
                        {props.description && <CardDescription>{props.description}</CardDescription>}
                    </CardHeader>
                )}
                <CardContent>{children}</CardContent>
            </Card>
        ),

        // ── Address Components ─────────────────────────────────────────
        AddressSummary: ({ props }) => <AddressSummary address={props.address} />,

        // ── Transaction Components ─────────────────────────────────────
        LatestTransactions: ({ props }) => (
            <LatestTransactions
                limit={props.limit}
                sort={props.sort}
                order={props.order}
                fromTimestamp={props.fromTimestamp}
                toTimestamp={props.toTimestamp}
            />
        ),

        AddressTransactions: ({ props }) => (
            <AddressTransactions
                address={props.address}
                limit={props.limit}
                asset={props.asset}
                sort={props.sort}
                order={props.order}
                fromTimestamp={props.fromTimestamp}
                toTimestamp={props.toTimestamp}
            />
        ),

        TransactionDetail: ({ props }) => <TransactionDetail txid={props.txid} />,

        TransactionFlow: ({ props }) => <TransactionFlow txid={props.txid} />,

        // ── Token Components ───────────────────────────────────────────
        TokenDetail: ({ props }) => <TokenDetail identifier={props.identifier} />,

        TokenSearch: ({ props }) => <TokenSearch query={props.query} limit={props.limit} />,

        TokenHolders: ({ props }) => <TokenHolders identifier={props.identifier} limit={props.limit} />,

        TokenTransactions: ({ props }) => <TokenTransactions identifier={props.identifier} limit={props.limit} />,

        AddressTokens: ({ props }) => <AddressTokens address={props.address} />,

        TokenList: ({ props }) => (
            <TokenList
                limit={props.limit}
                sort={props.sort}
                sortDirection={props.sortDirection}
                hasIcon={props.hasIcon}
                minHolders={props.minHolders}
            />
        ),

        // ── Leaderboard Components ──────────────────────────────────────
        WalletLeaderboard: ({ props }) => <WalletLeaderboard limit={props.limit} />,

        TokenLeaderboard: ({ props }) => <TokenLeaderboard limit={props.limit} sort={props.sort} />,

        // ── Chart Components ───────────────────────────────────────────
        BalanceHistoryChart: ({ props }) => (
            <BalanceHistoryChart address={props.address} chartType={props.chartType} title={props.title} />
        ),

        TokenBalanceChart: ({ props }) => (
            <TokenBalanceChart
                address={props.address}
                tokenIdentifier={props.tokenIdentifier}
                chartType={props.chartType}
                title={props.title}
            />
        ),

        NetWorthChart: ({ props }) => (
            <NetWorthChart address={props.address} chartType={props.chartType} title={props.title} />
        ),

        TokenDistributionChart: ({ props }) => (
            <TokenDistributionChart
                address={props.address}
                chartType={props.chartType}
                metric={props.metric}
                title={props.title}
            />
        ),

        TotalPlatformVolume: ({ props }) => <TotalPlatformVolume chartType={props.chartType} title={props.title} />,

        // ── Flashnet AMM Components ─────────────────────────────────────
        FlashnetPools: ({ props }) => (
            <FlashnetPools
                limit={props.limit}
                offset={props.offset}
                sort={props.sort}
                minVolume24h={props.minVolume24h}
                minTvl={props.minTvl}
                curveTypes={props.curveTypes}
                hostNames={props.hostNames}
            />
        ),

        FlashnetPoolDetail: ({ props }) => <FlashnetPoolDetail poolId={props.poolId} />,

        FlashnetHostDetail: ({ props }) => <FlashnetHostDetail namespace={props.namespace} />,

        // ── Generic / Utility ──────────────────────────────────────────
        Markdown: ({ props }) => {
            // Lazy import to keep registry light
            const ReactMarkdown = require('react-markdown').default;
            return (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{props.content}</ReactMarkdown>
                </div>
            );
        },
    },

    actions: {
        navigate_address: async (params) => {
            if (params) window.location.href = `/address/${params.address}`;
        },
        navigate_tx: async (params) => {
            if (params) window.location.href = `/tx/${params.txid}`;
        },
        navigate_token: async (params) => {
            if (params) window.location.href = `/token/${params.identifier}`;
        },
        copy_to_clipboard: async (params) => {
            if (params) await navigator.clipboard.writeText(params.value);
        },
    },
});

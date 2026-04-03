import { defineCatalog } from '@json-render/core';
import { z } from 'zod';
import { schema } from './schema';

// ─── Shared Schemas ──────────────────────────────────────────────────

const columnSpec = z
    .object({
        key: z.string(),
        label: z.string(),
        type: z.enum([
            'text',
            'number',
            'compact-number',
            'pool-price',
            'change-percent',
            'curve-type',
            'address',
            'txid',
            'sats',
            'token-amount',
            'usd',
            'percent',
            'date',
            'timeago',
            'badge',
            'direction-badge',
            'tx-type-badge',
            'status-badge',
            'icon-url',
        ]),
        sortable: z.boolean().default(true),
    })
    .describe('Column specification for table components');

// ─── Shared layout prop (lets the LLM control inline vs panel placement) ────

const layoutProp = z
    .enum(['inline', 'panel'])
    .optional()
    .describe(
        'Where to render: "inline" keeps it in chat, "panel" opens the side panel. Omit to use the default heuristic.',
    );

/** Helper: merge a component props schema with the shared layout prop */
function withLayout<T extends z.ZodRawShape>(shape: T) {
    return z.object({ ...shape, layout: layoutProp });
}

// ─── Catalog Definition ──────────────────────────────────────────────

export const catalog = defineCatalog(schema, {
    components: {
        // ── Layout Primitives ──────────────────────────────────────────
        Grid: {
            props: withLayout({
                columns: z.number().min(1).max(12).default(12),
                gap: z.number().min(0).max(8).default(4),
            }),
            slots: ['default'],
            description: 'CSS grid container. Use with GridItem children. 12-column system. Gap is multiplied by 4px.',
        },
        GridItem: {
            props: z.object({
                colSpan: z.number().min(1).max(12).default(12),
            }),
            slots: ['default'],
            description: 'Grid cell. colSpan controls width (1-12). Common: 12=full, 6=half, 4=third, 3=quarter.',
        },
        Card: {
            props: withLayout({
                title: z.string().optional(),
                description: z.string().optional(),
            }),
            slots: ['default'],
            description: 'Card container with optional title and description.',
        },

        // ── Address Components ─────────────────────────────────────────
        AddressSummary: {
            props: withLayout({
                address: z.string().describe('Spark address (sp1...) or public key hex'),
            }),
            description:
                'Full address overview card. Shows BTC balance, token value, total value, transaction count, token count, and top token holdings. Self-fetches from GET /v1/address/{address}.',
        },

        // ── Transaction Components ─────────────────────────────────────
        LatestTransactions: {
            props: withLayout({
                limit: z.number().min(1).max(250).default(25),
                sort: z.enum(['created_at', 'updated_at']).default('created_at').describe('Field to sort by'),
                order: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
                fromTimestamp: z
                    .string()
                    .optional()
                    .describe('ISO 8601 timestamp — only show transactions created after this time'),
                toTimestamp: z
                    .string()
                    .optional()
                    .describe('ISO 8601 timestamp — only show transactions created before this time'),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Network-wide latest transactions table with pagination. Supports sorting by created_at or updated_at, sort direction (asc/desc), and timestamp range filtering via fromTimestamp/toTimestamp (ISO 8601). Self-fetches from GET /v1/tx/latest.',
        },
        AddressTransactions: {
            props: withLayout({
                address: z.string().describe('Spark address'),
                limit: z.number().min(1).max(100).default(25),
                asset: z
                    .string()
                    .optional()
                    .describe('Filter transactions to a specific token by its identifier (64-char hex)'),
                sort: z.enum(['created_at', 'updated_at']).default('created_at').describe('Field to sort by'),
                order: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
                fromTimestamp: z
                    .string()
                    .optional()
                    .describe('ISO 8601 timestamp — only show transactions created after this time'),
                toTimestamp: z
                    .string()
                    .optional()
                    .describe('ISO 8601 timestamp — only show transactions created before this time'),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Paginated transactions for a specific address. Shows direction, type, status, value, time. Supports sorting (created_at/updated_at), direction (asc/desc), timestamp range filtering (fromTimestamp/toTimestamp as ISO 8601), and filtering by token (asset). Self-fetches from GET /v1/address/{address}/transactions.',
        },
        TransactionDetail: {
            props: withLayout({
                txid: z.string().describe('Spark transaction ID'),
            }),
            description:
                'Single transaction detail view. Shows type, status, from/to, amounts, timestamps, and Bitcoin tx data if applicable. Self-fetches from GET /v1/tx/{txid}.',
        },
        TransactionFlow: {
            props: withLayout({
                txid: z.string().describe('Spark transaction ID'),
            }),
            description:
                'React Flow diagram for multi-IO token_multi_transfer transactions. Shows inputs on left, central tx node, outputs on right with animated edges. ONLY use for token_multi_transfer type transactions. Self-fetches from GET /v1/tx/{txid}.',
        },

        // ── Token Components ───────────────────────────────────────────
        TokenDetail: {
            props: withLayout({
                identifier: z.string().describe('Token identifier (64-char hex or btk... bech32 address)'),
            }),
            description:
                'Token info card. Shows name, ticker, price, market cap, 24h volume, supply, holder count, decimals. Self-fetches from GET /v1/tokens/{identifier}.',
        },
        TokenSearch: {
            props: withLayout({
                query: z.string().describe('Search query string'),
                limit: z.number().min(1).max(50).default(10),
            }),
            description:
                'Token search results list. Shows matching tokens with icons and addresses. Self-fetches from GET /v1/tokens/{query}.',
        },
        TokenHolders: {
            props: withLayout({
                identifier: z.string().describe('Token identifier'),
                limit: z.number().min(1).max(75).default(25),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Token holders table sorted by balance. Shows address, balance, USD value, % of supply. Self-fetches from GET /v1/tokens/{identifier}/holders.',
        },
        TokenTransactions: {
            props: withLayout({
                identifier: z.string().describe('Token identifier'),
                limit: z.number().min(1).max(100).default(25),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Paginated transactions for a specific token. Self-fetches from GET /v1/tokens/{identifier}/transactions.',
        },
        AddressTokens: {
            props: withLayout({
                address: z.string().describe('Spark address'),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'All tokens held by an address. Shows icon, name, ticker, balance, USD value. Self-fetches from GET /v1/address/{address}/tokens.',
        },
        TokenList: {
            props: withLayout({
                limit: z.number().min(1).max(50).default(25),
                sort: z
                    .enum(['holders', 'updated_at', 'created_at', 'supply'])
                    .default('updated_at')
                    .describe('Field to sort tokens by'),
                sortDirection: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
                hasIcon: z.boolean().optional().describe('Filter to only tokens that have an icon'),
                minHolders: z.number().optional().describe('Filter to tokens with at least this many holders'),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Browse all tokens on the network. Cursor-paginated. Supports sorting by holders, updated_at, created_at, or supply (asc/desc), and filtering by hasIcon and minHolders. Self-fetches from GET /v2/tokens/list.',
        },

        // ── Chart Components ───────────────────────────────────────────
        BalanceHistoryChart: {
            props: withLayout({
                address: z.string().describe('Spark address'),
                chartType: z.enum(['line', 'area']).default('area'),
                title: z.string().default('Balance History'),
            }),
            description: 'Sats balance over time chart. Self-fetches from GET /v2/historical/sats/balances/{address}.',
        },
        TokenBalanceChart: {
            props: withLayout({
                address: z.string().describe('Spark address'),
                tokenIdentifier: z.string().describe('Token identifier'),
                chartType: z.enum(['line', 'area']).default('area'),
                title: z.string().optional(),
            }),
            description:
                'Token balance over time chart. Self-fetches from GET /v2/historical/tokens/balances/{address}/{tokenIdentifier}.',
        },
        NetWorthChart: {
            props: withLayout({
                address: z.string().describe('Spark address'),
                chartType: z.enum(['line', 'area']).default('area'),
                title: z.string().default('Net Worth History'),
            }),
            description: 'USD net worth over time chart. Self-fetches from GET /v2/historical/net-worth/{address}.',
        },
        TokenDistributionChart: {
            props: withLayout({
                address: z.string().describe('Spark address'),
                chartType: z.enum(['pie', 'bar', 'donut']).default('pie'),
                metric: z.enum(['valueUsd', 'balance']).default('valueUsd'),
                title: z.string().default('Token Distribution'),
            }),
            description:
                'Portfolio breakdown chart. Shows token holdings as pie, bar, or donut chart. Self-fetches from GET /v1/address/{address}/tokens.',
        },
        TotalPlatformVolume: {
            props: withLayout({
                chartType: z.enum(['area', 'line', 'bar']).default('area'),
                title: z.string().default('Total Platform Volume'),
            }),
            description: 'Network total platform volume stats. Self-fetches from GET /v2/stats/tpv.',
        },

        // ── Leaderboard Components ──────────────────────────────────────
        WalletLeaderboard: {
            props: withLayout({
                limit: z.number().min(1).max(100).default(25),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Top wallets ranked by total value held. Shows rank, address, value in sats and USD. Fetches server-side from leaderboard API.',
        },
        TokenLeaderboard: {
            props: withLayout({
                limit: z.number().min(1).max(100).default(25),
                sort: z.enum(['holders', 'updated_at']).default('holders'),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Top tokens ranked by holder count or update time. Shows rank, icon, name, ticker, holders, price, market cap. Fetches server-side from leaderboard API.',
        },

        // ── Flashnet AMM Components ─────────────────────────────────────
        FlashnetPools: {
            props: withLayout({
                limit: z.number().min(1).max(100).default(25),
                offset: z.number().min(0).default(0),
                sort: z
                    .enum([
                        'tvlAssetB:desc',
                        'tvlAssetB:asc',
                        'volume24hAssetB:desc',
                        'volume24hAssetB:asc',
                        'currentPriceAInB:desc',
                        'currentPriceAInB:asc',
                        'priceChangePercent24h:desc',
                        'priceChangePercent24h:asc',
                        'createdAt:desc',
                        'createdAt:asc',
                        'lpFeeBps:desc',
                        'lpFeeBps:asc',
                    ])
                    .default('tvlAssetB:desc')
                    .describe('Sort field and direction. Default: highest TVL first.'),
                minVolume24h: z.number().optional().describe('Minimum 24h volume filter'),
                minTvl: z.number().optional().describe('Minimum TVL filter'),
                curveTypes: z
                    .array(z.enum(['CONSTANT_PRODUCT', 'SINGLE_SIDED']))
                    .optional()
                    .describe('Filter by curve type'),
                hostNames: z.array(z.string()).optional().describe('Filter by host namespaces'),
                columns: z.array(columnSpec).optional(),
            }),
            description:
                'Paginated table of Flashnet AMM pools. Sorted by TVL (highest first) by default. Shows host, asset A, curve type, TVL, 24h volume, price, 24h change, and fees. Asset B column is hidden by default (always the same) — only include it if explicitly requested. Supports sorting, filtering by curve type, host, min volume, min TVL. Self-fetches from GET /v1/pools.',
        },
        FlashnetPoolDetail: {
            props: withLayout({
                poolId: z.string().describe('Pool LP public key'),
            }),
            description:
                'Detailed view of a single Flashnet AMM pool. Shows curve type, host, reserves, TVL, volume, price, fees, and bonding progress. Self-fetches from GET /v1/pools.',
        },
        FlashnetHostDetail: {
            props: withLayout({
                namespace: z.string().describe('Host namespace identifier'),
            }),
            description:
                'Flashnet host info card. Shows namespace, fee recipient, min fee, and creation date. Self-fetches from GET /v1/hosts/{namespace}.',
        },

        // ── Generic / Utility ──────────────────────────────────────────
        Markdown: {
            props: withLayout({
                content: z.string().describe('Markdown text content'),
            }),
            description: 'Render markdown text inline.',
        },
    },

    actions: {
        navigate_address: {
            params: z.object({
                address: z.string(),
            }),
            description: 'Navigate to an address detail page',
        },
        navigate_tx: {
            params: z.object({
                txid: z.string(),
            }),
            description: 'Navigate to a transaction detail page',
        },
        navigate_token: {
            params: z.object({
                identifier: z.string(),
            }),
            description: 'Navigate to a token detail page',
        },
        copy_to_clipboard: {
            params: z.object({
                value: z.string(),
            }),
            description: 'Copy a value to clipboard',
        },
    },
});

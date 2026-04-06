import { generateText, type LanguageModel, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { flashnetFetch, sparkscanFetch } from './api';
import { formatUsd } from './formatters';
import type {
    AddressSummaryData,
    AddressTokensResponse,
    AddressTransaction,
    FlashnetHost,
    FlashnetPingResponse,
    FlashnetPoolsResponse,
    FlashnetSimulateAddLiquidityResponse,
    FlashnetSimulateRemoveLiquidityResponse,
    NetworkSummary,
    PaginatedResponse,
    TokenDetail,
    TokenHolder,
    TokenLeaderboardResponse,
    TokenListResponse,
    Transaction,
    WalletLeaderboard,
} from './types';

/**
 * Summarize helpers — create compact text summaries for the LLM.
 * The full data goes to the client (tool execute return).
 * The summary goes to the LLM (toModelOutput).
 */

function summarizeNetworkStats(data: NetworkSummary): string {
    return `Network stats: TVL ${formatUsd(data.totalValueLockedUsd)} (${data.totalValueLockedSats.toLocaleString()} sats), ${data.activeAccounts.toLocaleString()} active accounts, ${data.transactions24h.toLocaleString()} txs in 24h, BTC price ${formatUsd(data.currentBtcPriceUsd)}.`;
}

function summarizeAddress(data: AddressSummaryData): string {
    return `Address ${data.sparkAddress}: BTC ${data.balance.btcSoftBalanceSats.toLocaleString()} sats (${formatUsd(data.balance.btcValueUsdSoft)}), ${data.tokenCount} tokens (${formatUsd(data.balance.totalTokenValueUsd)}), total ${formatUsd(data.totalValueUsd)}, ${data.transactionCount} txs.`;
}

function summarizeTransaction(tx: Transaction): string {
    const amount =
        tx.amountSats != null
            ? `${tx.amountSats.toLocaleString()} sats`
            : tx.amount
              ? `${tx.amount} tokens`
              : 'unknown amount';
    const flowHint = tx.type === 'token_multi_transfer' ? ' Render TransactionFlow.' : '';
    return `Tx ${tx.id}: ${tx.type} (${tx.status}), ${amount}, from ${tx.from?.identifier ?? 'unknown'} to ${tx.to?.identifier ?? 'unknown'}, ${tx.createdAt}.${flowHint}`;
}

function summarizeTransactions(txs: Transaction[]): string {
    const types: Record<string, number> = {};
    let totalUsd = 0;
    for (const tx of txs) {
        types[tx.type] = (types[tx.type] ?? 0) + 1;
        totalUsd += tx.valueUsd ?? 0;
    }
    const typeSummary = Object.entries(types)
        .map(([t, c]) => `${c} ${t}`)
        .join(', ');
    const multiTransferIds = txs.filter((tx) => tx.type === 'token_multi_transfer').map((tx) => tx.id);
    const multiTransferNote =
        multiTransferIds.length > 0 ? ` token_multi_transfer IDs: ${multiTransferIds.join(', ')}.` : '';
    return `${txs.length} transactions. Types: ${typeSummary}. Total value: ${formatUsd(totalUsd)}. Most recent: ${txs[0]?.id ?? 'none'} (${txs[0]?.type ?? ''}).${multiTransferNote}`;
}

function summarizeAddressTransactions(data: PaginatedResponse<AddressTransaction>): string {
    const types: Record<string, number> = {};
    let totalUsd = 0;
    for (const tx of data.data) {
        types[tx.type] = (types[tx.type] ?? 0) + 1;
        totalUsd += tx.valueUsd ?? 0;
    }
    const typeSummary = Object.entries(types)
        .map(([t, c]) => `${c} ${t}`)
        .join(', ');
    const multiTransferIds = data.data.filter((tx) => tx.type === 'token_multi_transfer').map((tx) => tx.id);
    const multiTransferNote =
        multiTransferIds.length > 0 ? ` token_multi_transfer IDs: ${multiTransferIds.join(', ')}.` : '';
    return `${data.meta.totalItems} total transactions (showing ${data.data.length}). Types: ${typeSummary}. Total value shown: ${formatUsd(totalUsd)}.${multiTransferNote}`;
}

function summarizeTokenDetail(data: TokenDetail): string {
    const supply = Number(data.totalSupply) / 10 ** data.metadata.decimals;
    const derivedPrice = supply > 0 ? data.marketCapUsd / supply : 0;
    return `Token ${data.metadata.name} (${data.metadata.ticker}): price ${formatUsd(derivedPrice)}, market cap ${formatUsd(data.marketCapUsd)}, 24h volume ${formatUsd(data.volume24hUsd)}, ${data.metadata.holderCount} holders, supply ${data.totalSupply}.`;
}

function summarizeTokenHolders(data: PaginatedResponse<TokenHolder>): string {
    const top3 = data.data
        .slice(0, 3)
        .map((h) => `${h.address.slice(0, 12)}... (${h.percentage.toFixed(2)}%)`)
        .join(', ');
    return `${data.meta.totalItems} holders. Top 3: ${top3}.`;
}

function summarizeAddressTokens(data: AddressTokensResponse): string {
    const top = data.tokens
        .slice(0, 5)
        .map((t) => `${t.ticker} (${formatUsd(t.valueUsd)})`)
        .join(', ');
    return `${data.tokenCount} tokens, total value ${formatUsd(data.totalTokenValueUsd)}. Top: ${top}.`;
}

function summarizeTokenList(data: TokenListResponse): string {
    const top = data.tokens
        .slice(0, 5)
        .map((t) => `${t.ticker} (${t.holderCount} holders)`)
        .join(', ');
    return `${data.totalTokens} tokens on network. Top: ${top}.`;
}

function summarizeWalletLeaderboard(data: WalletLeaderboard): string {
    const top3 = data.leaderboard
        .slice(0, 3)
        .map((w) => `#${w.rank} ${w.sparkAddress.slice(0, 12)}... (${formatUsd(w.totalValueUsd)})`)
        .join(', ');
    return `Wallet leaderboard: ${data.leaderboard.length} wallets. Top 3: ${top3}. BTC price: ${formatUsd(data.currentBtcPriceUsd)}.`;
}

function summarizeTokenLeaderboard(data: TokenLeaderboardResponse): string {
    const top3 = data.leaderboard
        .slice(0, 3)
        .map((t) => `#${t.rank} ${t.ticker} (${t.holderCount} holders, ${formatUsd(t.marketCapUsd)} mcap)`)
        .join(', ');
    return `Token leaderboard: ${data.totalTokens} tokens. Top 3: ${top3}.`;
}

const textOutput = (value: string) => ({ type: 'text' as const, value });

/** Wrap toModelOutput so a thrown error doesn't silently kill the agent loop. */
function safeModelOutput(fn: (args: { output: unknown }) => Promise<{ type: 'text'; value: string }>) {
    return async (args: { output: unknown }) => {
        try {
            return await fn(args);
        } catch (error) {
            console.error('[toModelOutput] error:', error);
            return textOutput('Tool executed but failed to summarize the result.');
        }
    };
}

/**
 * AI SDK tools. Each tool:
 * - execute: returns FULL data (goes to client as tool result)
 * - toModelOutput: returns COMPACT summary (goes to LLM for reasoning)
 *
 * This means the LLM sees minimal tokens while the client gets full data.
 */
export const sparkscanTools = {
    getAddress: tool({
        description: 'Get address summary with balances, token holdings, and transaction count.',
        inputSchema: z.object({
            address: z.string().describe('Spark address (sp1... or spark1...) or public key hex'),
        }),
        execute: async ({ address }) => {
            return sparkscanFetch<AddressSummaryData>(`/v1/address/${address}`);
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeAddress(output as AddressSummaryData)),
        ),
    }),

    getTransaction: tool({
        description: "Get a single transaction's full details.",
        inputSchema: z.object({
            txid: z.string().describe('Spark transaction ID (UUID format)'),
        }),
        execute: async ({ txid }) => {
            return sparkscanFetch<Transaction>(`/v1/tx/${txid}`);
        },
        toModelOutput: safeModelOutput(async ({ output }) => textOutput(summarizeTransaction(output as Transaction))),
    }),

    getLatestTransactions: tool({
        description: 'Get the most recent network-wide transactions. Supports sorting and timestamp range filtering.',
        inputSchema: z.object({
            limit: z.number().min(1).max(250).default(10).describe('Number of transactions'),
            sort: z.enum(['created_at', 'updated_at']).default('created_at').describe('Field to sort by'),
            order: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
            from_timestamp: z.string().optional().describe('ISO 8601 — only transactions after this time'),
            to_timestamp: z.string().optional().describe('ISO 8601 — only transactions before this time'),
        }),
        execute: async ({ limit, sort, order, from_timestamp, to_timestamp }) => {
            return sparkscanFetch<Transaction[]>('/v1/tx/latest', {
                limit,
                sort,
                order,
                from_timestamp,
                to_timestamp,
            });
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeTransactions(output as Transaction[])),
        ),
    }),

    searchToken: tool({
        description: 'Search for a token by name, ticker, hex identifier, or btk... address.',
        inputSchema: z.object({
            identifier: z.string().describe('Token identifier or search query'),
        }),
        execute: async ({ identifier }) => {
            return sparkscanFetch<TokenDetail | TokenDetail[]>(`/v1/tokens/${encodeURIComponent(identifier)}`);
        },
        toModelOutput: safeModelOutput(async ({ output }) => {
            const data = output as TokenDetail | TokenDetail[];
            if (Array.isArray(data)) {
                return textOutput(
                    `Found ${data.length} tokens: ${data.map((t) => `${t.metadata?.name ?? 'Unknown'} (${t.metadata?.ticker ?? '?'})`).join(', ')}.`,
                );
            }
            return textOutput(summarizeTokenDetail(data));
        }),
    }),

    getTokenHolders: tool({
        description: 'Get top holders of a specific token sorted by balance.',
        inputSchema: z.object({
            identifier: z.string().describe('Token identifier'),
            limit: z.number().min(1).max(75).default(25).describe('Number of holders'),
        }),
        execute: async ({ identifier, limit }) => {
            return sparkscanFetch<PaginatedResponse<TokenHolder>>(`/v1/tokens/${identifier}/holders`, { limit });
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeTokenHolders(output as PaginatedResponse<TokenHolder>)),
        ),
    }),

    getNetworkStats: tool({
        description: 'Get network-wide summary statistics.',
        inputSchema: z.object({}),
        execute: async () => {
            return sparkscanFetch<NetworkSummary>('/v2/stats/summary');
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeNetworkStats(output as NetworkSummary)),
        ),
    }),

    getAddressTransactions: tool({
        description:
            'Get paginated transactions for an address. Supports sorting, direction, timestamp filtering, and token filtering.',
        inputSchema: z.object({
            address: z.string().describe('Spark address'),
            limit: z.number().min(1).max(100).default(25),
            sort: z.enum(['created_at', 'updated_at']).default('created_at').describe('Field to sort by'),
            order: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
            from_timestamp: z.string().optional().describe('ISO 8601 — only transactions after this time'),
            to_timestamp: z.string().optional().describe('ISO 8601 — only transactions before this time'),
            asset: z.string().optional().describe('Filter to a specific token by its identifier (64-char hex)'),
        }),
        execute: async ({ address, limit, sort, order, from_timestamp, to_timestamp, asset }) => {
            return sparkscanFetch<PaginatedResponse<AddressTransaction>>(`/v1/address/${address}/transactions`, {
                limit,
                sort,
                order,
                from_timestamp,
                to_timestamp,
                asset,
            });
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeAddressTransactions(output as PaginatedResponse<AddressTransaction>)),
        ),
    }),

    getAddressTokens: tool({
        description: 'Get all tokens held by an address.',
        inputSchema: z.object({
            address: z.string().describe('Spark address'),
        }),
        execute: async ({ address }) => {
            return sparkscanFetch<AddressTokensResponse>(`/v1/address/${address}/tokens`);
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeAddressTokens(output as AddressTokensResponse)),
        ),
    }),

    getTokenTransactions: tool({
        description: 'Get paginated transactions for a specific token.',
        inputSchema: z.object({
            identifier: z.string().describe('Token identifier'),
            limit: z.number().min(1).max(100).default(25),
        }),
        execute: async ({ identifier, limit }) => {
            return sparkscanFetch<PaginatedResponse<Transaction>>(`/v1/tokens/${identifier}/transactions`, { limit });
        },
        toModelOutput: safeModelOutput(async ({ output }) => {
            const data = output as PaginatedResponse<Transaction>;
            return textOutput(`${data.meta.totalItems} token transactions (showing ${data.data.length}).`);
        }),
    }),

    getTokenList: tool({
        description: 'Browse all tokens on the network. Supports sorting, direction, and filtering by icon/holders.',
        inputSchema: z.object({
            limit: z.number().min(1).max(50).default(25),
            sort: z
                .enum(['holders', 'updated_at', 'created_at', 'supply'])
                .default('updated_at')
                .describe('Field to sort by'),
            sortDirection: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
            hasIcon: z
                .boolean()
                .optional()
                .describe('When true, only return tokens that have an icon. Omit or leave false to return all tokens.'),
            minHolders: z.number().optional().describe('Filter to tokens with at least this many holders'),
        }),
        execute: async ({ limit, sort, sortDirection, hasIcon, minHolders }) => {
            return sparkscanFetch<TokenListResponse>('/v2/tokens/list', {
                limit,
                sort,
                sortDirection,
                ...(hasIcon ? { hasIcon: 'true' } : {}),
                ...(minHolders !== undefined ? { minHolders } : {}),
            });
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeTokenList(output as TokenListResponse)),
        ),
    }),

    getWalletLeaderboard: tool({
        description: 'Get top wallets ranked by total value held.',
        inputSchema: z.object({
            limit: z.number().min(1).max(100).default(25).describe('Number of wallets to return'),
        }),
        execute: async ({ limit }) => {
            return sparkscanFetch<WalletLeaderboard>(
                '/internal/mZzU4Db6GgL1Reqs51le0IMSNSiqzU2E/stats/leaderboard/wallets',
                { limit },
            );
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeWalletLeaderboard(output as WalletLeaderboard)),
        ),
    }),

    getTokenLeaderboard: tool({
        description: 'Get top tokens ranked by holder count or update time.',
        inputSchema: z.object({
            limit: z.number().min(1).max(100).default(25).describe('Number of tokens to return'),
            sort: z.enum(['holders', 'updated_at']).default('holders').describe('Sort by holder count or last update'),
        }),
        execute: async ({ limit, sort }) => {
            return sparkscanFetch<TokenLeaderboardResponse>(
                '/internal/mZzU4Db6GgL1Reqs51le0IMSNSiqzU2E/stats/leaderboard/tokens',
                { limit, sort },
            );
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeTokenLeaderboard(output as TokenLeaderboardResponse)),
        ),
    }),
};

// ─── Flashnet AMM Tools ─────────────────────────────────────────────

function summarizeFlashnetPools(data: FlashnetPoolsResponse): string {
    const top = data.pools
        .slice(0, 5)
        .map(
            (p) =>
                `${p.hostName}: ${p.assetAAddress.slice(0, 8)}.../${p.assetBAddress.slice(0, 8)}... (${p.curveType}, TVL ${p.tvlAssetB}, vol24h ${p.volume24hAssetB})`,
        )
        .join('; ');
    return `${data.totalCount} Flashnet AMM pools. Top: ${top}.`;
}

function summarizeFlashnetHost(host: FlashnetHost): string {
    return `Host ${host.namespace}: fee recipient ${host.feeRecipientPublicKey.slice(0, 12)}..., min fee ${host.minFeeBps}bps, created ${host.createdAt}.`;
}

export const flashnetTools = {
    getFlashnetPools: tool({
        description: 'List Flashnet AMM pools with optional filtering by assets, host, volume, TVL, and curve type.',
        inputSchema: z.object({
            limit: z.number().min(1).max(100).default(25).describe('Number of pools to return'),
            offset: z.number().min(0).default(0).describe('Pagination offset'),
            sort: z
                .string()
                .optional()
                .describe(
                    "Sort field:direction, e.g. 'tvlAssetB:desc', 'volume24hAssetB:desc', 'currentPriceAInB:desc', 'priceChangePercent24h:desc', 'createdAt:desc'. Default: tvlAssetB:desc",
                ),
            minVolume24h: z.number().optional().describe('Minimum 24h volume filter'),
            minTvl: z.number().optional().describe('Minimum TVL filter'),
            curveTypes: z
                .array(z.enum(['CONSTANT_PRODUCT', 'SINGLE_SIDED']))
                .optional()
                .describe('Filter by curve type'),
            hostNames: z.array(z.string()).optional().describe('Filter by host namespaces'),
            assetAAddress: z.string().optional().describe('Filter by asset A address'),
            assetBAddress: z.string().optional().describe('Filter by asset B address'),
        }),
        execute: async ({
            limit,
            offset,
            sort,
            minVolume24h,
            minTvl,
            curveTypes,
            hostNames,
            assetAAddress,
            assetBAddress,
        }) => {
            return flashnetFetch<FlashnetPoolsResponse>('/v1/pools', {
                limit,
                offset,
                ...(sort ? { sort } : {}),
                ...(minVolume24h !== undefined ? { minVolume24h } : {}),
                ...(minTvl !== undefined ? { minTvl } : {}),
                ...(curveTypes?.length ? { curveTypes: curveTypes.join(',') } : {}),
                ...(hostNames?.length ? { hostNames: hostNames.join(',') } : {}),
                ...(assetAAddress ? { assetAAddress } : {}),
                ...(assetBAddress ? { assetBAddress } : {}),
            });
        },
        toModelOutput: safeModelOutput(async ({ output }) =>
            textOutput(summarizeFlashnetPools(output as FlashnetPoolsResponse)),
        ),
    }),

    getFlashnetHost: tool({
        description: 'Get Flashnet host configuration and registration details by namespace.',
        inputSchema: z.object({
            namespace: z.string().describe('Host namespace identifier'),
        }),
        execute: async ({ namespace }) => {
            return flashnetFetch<FlashnetHost>(`/v1/hosts/${encodeURIComponent(namespace)}`);
        },
        toModelOutput: safeModelOutput(async ({ output }) => textOutput(summarizeFlashnetHost(output as FlashnetHost))),
    }),

    getFlashnetHealth: tool({
        description: 'Check Flashnet AMM settlement health status.',
        inputSchema: z.object({}),
        execute: async () => {
            return flashnetFetch<FlashnetPingResponse>('/v1/ping');
        },
        toModelOutput: safeModelOutput(async ({ output }) => {
            const data = output as FlashnetPingResponse;
            return textOutput(
                `Flashnet status: ${data.status}, gateway ${data.gatewayTimestamp}, settlement ${data.settlementTimestamp}.`,
            );
        }),
    }),

    simulateAddLiquidity: tool({
        description:
            'Preview the results of adding liquidity to a Flashnet AMM pool before execution. No auth required.',
        inputSchema: z.object({
            poolId: z.string().describe('Pool LP public key'),
            assetAAmount: z.string().describe('Amount of asset A to add'),
            assetBAmount: z.string().describe('Amount of asset B to add'),
        }),
        execute: async ({ poolId, assetAAmount, assetBAmount }) => {
            const res = await fetch(
                new URL(
                    '/v1/liquidity/add/simulate',
                    process.env.FLASHNET_API_URL || 'https://api.flashnet.xyz',
                ).toString(),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ poolId, assetAAmount, assetBAmount }),
                },
            );
            if (!res.ok) throw new Error(`Flashnet API error: ${res.status} ${res.statusText}`);
            return res.json() as Promise<FlashnetSimulateAddLiquidityResponse>;
        },
        toModelOutput: safeModelOutput(async ({ output }) => {
            const data = output as FlashnetSimulateAddLiquidityResponse;
            return textOutput(
                `Add liquidity simulation: ${data.lpTokensToMint} LP tokens, pool share ${data.poolSharePercentage}%, A used ${data.assetAAmountToAdd}, B used ${data.assetBAmountToAdd}.${data.warningMessage ? ` Warning: ${data.warningMessage}` : ''}`,
            );
        }),
    }),

    simulateRemoveLiquidity: tool({
        description:
            'Preview the results of removing liquidity from a Flashnet AMM pool before execution. No auth required.',
        inputSchema: z.object({
            poolId: z.string().describe('Pool LP public key'),
            providerPublicKey: z.string().describe('Liquidity provider public key'),
            lpTokensToRemove: z.string().describe('Number of LP tokens to burn'),
        }),
        execute: async ({ poolId, providerPublicKey, lpTokensToRemove }) => {
            const res = await fetch(
                new URL(
                    '/v1/liquidity/remove/simulate',
                    process.env.FLASHNET_API_URL || 'https://api.flashnet.xyz',
                ).toString(),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ poolId, providerPublicKey, lpTokensToRemove }),
                },
            );
            if (!res.ok) throw new Error(`Flashnet API error: ${res.status} ${res.statusText}`);
            return res.json() as Promise<FlashnetSimulateRemoveLiquidityResponse>;
        },
        toModelOutput: safeModelOutput(async ({ output }) => {
            const data = output as FlashnetSimulateRemoveLiquidityResponse;
            return textOutput(
                `Remove liquidity simulation: get ${data.assetAAmount} A + ${data.assetBAmount} B, removing ${data.poolShareRemovedPercentage}% of pool share. Current LP balance: ${data.currentLpBalance}.${data.warningMessage ? ` Warning: ${data.warningMessage}` : ''}`,
            );
        }),
    }),
};

// ─── Subagent Tool Helpers ───────────────────────────────────────────

/**
 * Strip `toModelOutput` from a tool set so the model sees full raw data
 * instead of compact summaries. Used for the deep analysis subagent which
 * needs complete data to perform cross-entity analysis.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withFullOutput<T extends Record<string, any>>(tools: T): T {
    const result = {} as Record<string, unknown>;
    for (const [key, t] of Object.entries(tools)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { toModelOutput: _, ...rest } = t as any;
        result[key] = { ...rest };
    }
    return result as T;
}

// ─── Deep Analysis Subagent ─────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a Spark blockchain data analyst. You have tools to query on-chain data.

Your job: complete the analytical task by calling as many tools as needed, then write a structured summary.

Guidelines:
- Call tools to gather all the data you need before writing your analysis.
- Compute derived metrics: ratios, percentages, distributions, comparisons.
- Format numbers readably: $10.5M, 177K accounts, 3,984 txs.
- Structure your final response with **bold** key findings, bullet lists, and clear sections.
- Be thorough but concise — the main agent will relay your findings to the user.
- You can ONLY use tools and return text. You CANNOT render UI components.
- Always include full identifiers (addresses, tx IDs) in your response — never truncate.`;

export function createDeepAnalysisTool(model: LanguageModel) {
    return tool({
        description:
            'Delegate a complex analytical task to a research subagent. Use this for questions that require cross-referencing multiple data sources, comparing entities, analyzing patterns over time, or producing detailed reports. NOT for simple lookups or displaying a single component.',
        inputSchema: z.object({
            task: z
                .string()
                .describe(
                    'A clear, self-contained description of the analysis to perform. Include any specific addresses, token names, or parameters.',
                ),
        }),
        execute: async ({ task }, { abortSignal }) => {
            const result = await generateText({
                model,
                system: ANALYSIS_SYSTEM,
                prompt: task,
                tools: {
                    ...withFullOutput(sparkscanTools),
                    ...withFullOutput(flashnetTools),
                },
                stopWhen: stepCountIs(15),
                abortSignal,
            });
            return result.text;
        },
        toModelOutput: safeModelOutput(async ({ output }) => {
            const text = output as string;
            // Truncate if very long — the main agent only needs the summary
            return textOutput(text.length > 3000 ? `${text.slice(0, 3000)}…` : text);
        }),
    });
}

import { gateway, generateText, type LanguageModel, rerank, stepCountIs, type Tool, type ToolSet, tool } from 'ai';
import { map, scrape, search } from 'firecrawl-aisdk';
import { z } from 'zod';
import { flashnetFetch, flashnetPost, sparkscanFetch } from './api';
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

type GenerateTextProviderOptions = Parameters<typeof generateText>[0]['providerOptions'];

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
            return flashnetPost<FlashnetSimulateAddLiquidityResponse>('/v1/liquidity/add/simulate', {
                poolId,
                assetAAmount,
                assetBAmount,
            });
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
            return flashnetPost<FlashnetSimulateRemoveLiquidityResponse>('/v1/liquidity/remove/simulate', {
                poolId,
                providerPublicKey,
                lpTokensToRemove,
            });
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

// ─── researchSearch: cross-source fusion ────────────────────────────

export type ResearchItem =
    | { source: 'web'; title: string; url: string; snippet: string }
    | { source: 'spark' | 'flashnet'; title: string; text: string };

// MCP search tools advertise `{ query: string }` (per the Spark/Flashnet MCP
// schemas). We type loosely on output because each MCP returns a
// CallToolResult with provider-specific text content.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type McpSearchTool = Tool<{ query: string }, any>;

interface ResearchSearchOptions {
    rerankModelId: string;
    sparkSearch?: McpSearchTool;
    flashnetSearch?: McpSearchTool;
}

/**
 * Extract plain-text snippets from an MCP CallToolResult. MCP servers return
 * `{ content: [{ type: 'text', text: '...' }, ...] }`. Each text chunk
 * becomes one rerank candidate. If the server returns one big blob, that's
 * one candidate; rerank still scores it usefully alongside web snippets.
 *
 * MCP tools signal tool-level failure via `isError: true` instead of
 * throwing, so we drop those payloads here — otherwise an error message
 * could be reranked as if it were a real docs hit.
 */
function mcpResultToItems(
    raw: unknown,
    source: 'spark' | 'flashnet',
): Array<Extract<ResearchItem, { source: 'spark' | 'flashnet' }>> {
    if (!raw || typeof raw !== 'object') return [];
    if ((raw as { isError?: unknown }).isError === true) {
        console.error(`[researchSearch] ${source} MCP returned isError:`, raw);
        return [];
    }
    const content = (raw as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    const items: Array<Extract<ResearchItem, { source: 'spark' | 'flashnet' }>> = [];
    for (const part of content) {
        if (
            part &&
            typeof part === 'object' &&
            (part as { type?: unknown }).type === 'text' &&
            typeof (part as { text?: unknown }).text === 'string'
        ) {
            const text = (part as { text: string }).text.trim();
            if (text.length === 0) continue;
            const firstLine =
                text
                    .split('\n', 1)[0]
                    ?.replace(/^#+\s*/, '')
                    .slice(0, 120) ?? '';
            items.push({ source, title: firstLine, text });
        }
    }
    return items;
}

function itemToRerankDoc(item: ResearchItem): string {
    if (item.source === 'web') {
        return `${item.title}\n${item.url}\n${item.snippet}`.trim();
    }
    return `${item.title}\n${item.text}`.trim();
}

/**
 * Pick up to `topN` items, round-robin across sources, so a long Firecrawl
 * result list can't crowd out the docs hits. Used as the rerank fallback —
 * the rerank path itself surfaces docs hits naturally via scoring.
 */
function balancedTopN(items: ResearchItem[], topN: number): ResearchItem[] {
    if (items.length <= topN) return items;
    const groups = new Map<string, ResearchItem[]>();
    for (const item of items) {
        const list = groups.get(item.source) ?? [];
        list.push(item);
        groups.set(item.source, list);
    }
    const lists = Array.from(groups.values());
    const result: ResearchItem[] = [];
    let i = 0;
    while (result.length < topN && lists.some((l) => l.length > 0)) {
        const next = lists[i % lists.length]?.shift();
        if (next) result.push(next);
        i++;
    }
    return result;
}

export function createResearchSearchTool({ rerankModelId, sparkSearch, flashnetSearch }: ResearchSearchOptions) {
    return tool({
        description:
            'Fused research search across the open web (Firecrawl), the Spark docs MCP, and the Flashnet docs MCP. Calls all available sources in parallel, then reranks the combined results by relevance to the query. Use this first for any research / context-gathering step; drill into specific hits with `scrape` (URL) or `query_docs_filesystem_spark` / `query_docs_filesystem_flashnet` (docs filesystem grep).',
        inputSchema: z.object({
            query: z.string().describe('The research query.'),
            topN: z
                .number()
                .min(1)
                .max(20)
                .default(8)
                .describe('Number of top results to return after reranking (default 8).'),
        }),
        execute: async ({ query, topN }, { toolCallId, messages, abortSignal }) => {
            const callOpts = { toolCallId, messages, abortSignal };
            const [webRes, sparkRes, flashnetRes] = await Promise.allSettled([
                (async (): Promise<ResearchItem[]> => {
                    if (!search.execute) return [];
                    const data = (await search.execute({ query, limit: 10 }, callOpts)) as {
                        web?: Array<{ url?: string; title?: string; description?: string }>;
                    };
                    const items: ResearchItem[] = [];
                    for (const r of data.web ?? []) {
                        if (typeof r.url !== 'string') continue;
                        items.push({
                            source: 'web',
                            title: r.title ?? r.url,
                            url: r.url,
                            snippet: r.description ?? '',
                        });
                    }
                    return items;
                })(),
                (async (): Promise<ResearchItem[]> => {
                    if (!sparkSearch?.execute) return [];
                    const result = await sparkSearch.execute({ query }, callOpts);
                    return mcpResultToItems(result, 'spark');
                })(),
                (async (): Promise<ResearchItem[]> => {
                    if (!flashnetSearch?.execute) return [];
                    const result = await flashnetSearch.execute({ query }, callOpts);
                    return mcpResultToItems(result, 'flashnet');
                })(),
            ]);

            const log = (label: string, res: PromiseSettledResult<unknown>) => {
                if (res.status === 'rejected') {
                    console.error(`[researchSearch] ${label} failed:`, res.reason);
                }
            };
            log('web', webRes);
            log('spark', sparkRes);
            log('flashnet', flashnetRes);

            const items: ResearchItem[] = [
                ...(webRes.status === 'fulfilled' ? webRes.value : []),
                ...(sparkRes.status === 'fulfilled' ? sparkRes.value : []),
                ...(flashnetRes.status === 'fulfilled' ? flashnetRes.value : []),
            ];

            if (items.length === 0) return { items: [], reranked: false };
            if (items.length <= topN) return { items, reranked: false };

            try {
                const result = await rerank({
                    model: gateway.rerankingModel(rerankModelId),
                    query,
                    documents: items.map(itemToRerankDoc),
                    topN,
                    abortSignal,
                });
                return {
                    items: result.ranking
                        .map((r) => items[r.originalIndex])
                        .filter((x): x is ResearchItem => x != null),
                    reranked: true,
                };
            } catch (error) {
                // Rerank is the last step — if the gateway is flaky or the
                // model id is misconfigured we still have usable items from
                // the search fan-out. Degrade to a source-balanced top-N
                // (round-robin) so a 10-item Firecrawl batch doesn't crowd
                // out the docs hits when the slice gets taken.
                console.error('[researchSearch] rerank failed, returning unreranked balanced top-N:', error);
                return { items: balancedTopN(items, topN), reranked: false };
            }
        },
    });
}

// ─── Deep Analysis Subagent ─────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a Spark blockchain data analyst with on-chain, web, and documentation research capability. Your tools:

- **On-chain data**: Sparkscan + Flashnet tools (addresses, tokens, transactions, pools, etc.)
- **Cross-source research**: \`researchSearch\` — fans out to the open web (Firecrawl), the Spark docs MCP, and the Flashnet docs MCP in parallel, then reranks the combined results by relevance. Use this first for any research / context-gathering step.
- **Drill-down**: \`scrape\` (fetch a URL), \`map\` (discover URLs on a domain), \`query_docs_filesystem_spark\` / \`query_docs_filesystem_flashnet\` (rg/grep/cat over the docs filesystems — when available).

Your job: complete the analytical task by calling as many tools as needed, then write a structured summary.

Guidelines:
- Call tools to gather all the data you need before writing your analysis.
- Start research with \`researchSearch\` so you see the best hits across web + Spark docs + Flashnet docs in one ranked list. Then drill into specific hits with \`scrape\` or \`query_docs_filesystem_*\`.
- Combine web/docs findings with on-chain metrics when the question benefits from off-chain context (project descriptions, news, team info, recent events, SDK semantics).
- Cite source URLs (or docs paths) when you reference web or docs content.
- Compute derived metrics: ratios, percentages, distributions, comparisons.
- Format numbers readably: $10.5M, 177K accounts, 3,984 txs.
- Structure your final response with **bold** key findings, bullet lists, and clear sections.
- Be thorough but concise — the main agent will relay your findings to the user.
- You can ONLY use tools and return text. You CANNOT render UI components.
- Always include full identifiers (addresses, tx IDs) in your response — never truncate.`;

/**
 * Factory for tools that should not be eagerly connected — e.g. MCP-derived
 * tools that require network I/O to discover. Resolves to `{}` on failure
 * so a flaky docs server doesn't break the whole subagent.
 */
export type ExtraToolsFactory = () => Promise<ToolSet>;

async function resolveExtras(factory: ExtraToolsFactory | undefined, label: string): Promise<ToolSet> {
    if (!factory) return {};
    try {
        return await factory();
    } catch (error) {
        console.error(`[${label}] extra tools factory failed:`, error);
        return {};
    }
}

export function createDeepAnalysisTool(
    model: LanguageModel,
    providerOptions?: GenerateTextProviderOptions,
    extraToolsFactory?: ExtraToolsFactory,
) {
    return tool({
        description:
            'Delegate a complex analytical task to a research subagent. Use this for a SINGLE-ENTITY deep dive that needs cross-referencing multiple data sources, web research, or analyzing patterns over time. For multi-entity comparison or aggregation, use parallelAnalysis instead.',
        inputSchema: z.object({
            task: z
                .string()
                .describe(
                    'A clear, self-contained description of the analysis to perform. Include any specific addresses, token names, or parameters.',
                ),
        }),
        execute: async ({ task }, { abortSignal }) => {
            const extras = await resolveExtras(extraToolsFactory, 'deepAnalysis');
            const result = await generateText({
                model,
                providerOptions,
                system: ANALYSIS_SYSTEM,
                prompt: task,
                tools: {
                    ...withFullOutput(sparkscanTools),
                    ...withFullOutput(flashnetTools),
                    scrape,
                    map,
                    ...extras,
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

// ─── Parallel Analysis Subagents (fan-out) ──────────────────────────

type ParallelAnalysisResult = { id: string; text: string; ok: boolean };

export function createParallelAnalysisTool(
    model: LanguageModel,
    providerOptions?: GenerateTextProviderOptions,
    extraToolsFactory?: ExtraToolsFactory,
) {
    return tool({
        description:
            'Run multiple independent analyses in parallel, one subagent per task. Use when the user asks to COMPARE or AGGREGATE across N distinct entities (e.g. "compare these 3 tokens", "rank these wallets by activity"). Each task should be self-contained and analyzable independently. For a single-entity deep dive, use deepAnalysis instead.',
        inputSchema: z.object({
            tasks: z
                .array(
                    z.object({
                        id: z
                            .string()
                            .describe(
                                'Short identifier for this subtask (e.g. token ticker, address prefix, or label) — used to attribute results.',
                            ),
                        task: z
                            .string()
                            .describe(
                                'A clear, self-contained description of the analysis for this entity. Include the full identifier (address, token name, etc.).',
                            ),
                    }),
                )
                .min(2)
                .max(6)
                .describe('Between 2 and 6 independent subtasks to run concurrently.'),
        }),
        execute: async ({ tasks }, { abortSignal }): Promise<ParallelAnalysisResult[]> => {
            // Resolve once for the whole fan-out so all subtasks share the
            // same MCP connection (the factory caller is expected to memoize).
            const extras = await resolveExtras(extraToolsFactory, 'parallelAnalysis');
            const settled = await Promise.allSettled(
                tasks.map(async ({ task }) => {
                    const result = await generateText({
                        model,
                        providerOptions,
                        system: ANALYSIS_SYSTEM,
                        prompt: task,
                        tools: {
                            ...withFullOutput(sparkscanTools),
                            ...withFullOutput(flashnetTools),
                            scrape,
                            map,
                            ...extras,
                        },
                        stopWhen: stepCountIs(10),
                        abortSignal,
                    });
                    return result.text;
                }),
            );
            return settled.map((r, i) => {
                const id = tasks[i].id;
                if (r.status === 'fulfilled') return { id, text: r.value, ok: true };
                const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
                return { id, text: `Subagent failed: ${reason}`, ok: false };
            });
        },
        toModelOutput: safeModelOutput(async ({ output }) => {
            const items = output as ParallelAnalysisResult[];
            const PER_ITEM_LIMIT = 1500;
            const body = items
                .map((i) => {
                    const head = `## ${i.id}${i.ok ? '' : ' (failed)'}`;
                    const text = i.text.length > PER_ITEM_LIMIT ? `${i.text.slice(0, PER_ITEM_LIMIT)}…` : i.text;
                    return `${head}\n${text}`;
                })
                .join('\n\n');
            return textOutput(body);
        }),
    });
}

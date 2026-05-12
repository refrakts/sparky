import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { createJsonRenderTransform } from '@json-render/core';
import { withTracing } from '@posthog/ai';
import {
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    hasToolCall,
    stepCountIs,
    streamText,
    type ToolSet,
} from 'ai';
import type { NextRequest } from 'next/server';
import { env } from '@/env';
import { sparkscanFetch } from '@/lib/api';
import { getModel, getProviderOptions } from '@/lib/models';
import posthogClient from '@/lib/posthog';
import { withTimeout } from '@/lib/timeout';
import {
    createDeepAnalysisTool,
    createDelegateToWriterTool,
    createParallelAnalysisTool,
    createResearchSearchTool,
    flashnetTools,
    type SubagentStepEvent,
    sparkscanTools,
} from '@/lib/tools';
import type { NetworkSummary } from '@/lib/types';

export const maxDuration = 60;

// Per-stage MCP timeouts. The route's overall maxDuration is 60s; a slow
// docs server should not consume more than a small fraction of that before
// the subagent gives up on it and proceeds with the healthy sources.
const MCP_CONNECT_TIMEOUT_MS = 5_000;
const MCP_TOOLS_TIMEOUT_MS = 5_000;

/**
 * Connect to an MCP docs server with a timeout. If the connect succeeds
 * after we've already given up, the late client is closed to avoid leaking
 * a socket. All failure modes (timeout, network, server error) log + return
 * null so the worker still has the other backends.
 */
async function connectMcp(url: string, label: string): Promise<MCPClient | null> {
    try {
        return await withTimeout(
            createMCPClient({ transport: { type: 'http', url }, clientName: 'sparky' }),
            MCP_CONNECT_TIMEOUT_MS,
            `mcp:${label} connect`,
            (client) => {
                console.warn(`[mcp:${label}] connected after timeout — closing orphan client`);
                void client.close().catch(() => {});
            },
        );
    } catch (error) {
        console.error(`[mcp:${label}] connect failed (${url}):`, error);
        return null;
    }
}

/**
 * Fetch tool definitions from an MCP client, with a timeout. Tool discovery
 * is a second network step after `createMCPClient` and can fail
 * independently; a slow tools/list can't be allowed to delay the whole
 * subagent setup.
 */
async function safeTools(client: MCPClient | null, label: string): Promise<Record<string, unknown>> {
    if (!client) return {};
    try {
        const tools = await withTimeout(client.tools(), MCP_TOOLS_TIMEOUT_MS, `mcp:${label} tools/list`);
        return tools as Record<string, unknown>;
    } catch (error) {
        console.error(`[mcp:${label}] tools/list failed:`, error);
        return {};
    }
}

/**
 * Lazy MCP wiring. Connection + tool discovery happens on the first call to
 * `getExtras()` — typically inside a subagent execute, so simple chat
 * requests that never trigger deepAnalysis/parallelAnalysis don't pay the
 * docs MCP latency. `close()` is idempotent and a no-op if nothing was ever
 * opened.
 */
async function openSource(
    url: string,
    label: string,
): Promise<{ client: MCPClient | null; tools: Record<string, unknown> }> {
    const client = await connectMcp(url, label);
    const tools = await safeTools(client, label);
    return { client, tools };
}

function createMcpExtras(opts: { rerankModelId: string }): {
    getExtras: () => Promise<ToolSet>;
    close: () => Promise<void>;
} {
    let opened = false;
    let closed = false;
    let cached: Promise<ToolSet> | null = null;
    let clients: Array<MCPClient | null> = [];

    const open = async (): Promise<ToolSet> => {
        if (closed) return {};
        opened = true;
        // Per-source pipelines run independently so a hung Spark MCP can't
        // block Flashnet (or vice versa). Each pipeline is internally
        // bounded by per-stage timeouts inside connectMcp / safeTools, so
        // the whole open() is bounded even if both sources are slow.
        const [sparkResult, flashnetResult] = await Promise.all([
            openSource(env.SPARK_MCP_URL, 'spark'),
            openSource(env.FLASHNET_MCP_URL, 'flashnet'),
        ]);
        clients = [sparkResult.client, flashnetResult.client];
        const { search_spark: sparkSearchTool, ...sparkRest } = sparkResult.tools;
        const { search_flashnet: flashnetSearchTool, ...flashnetRest } = flashnetResult.tools;
        const researchSearch = createResearchSearchTool({
            rerankModelId: opts.rerankModelId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sparkSearch: sparkSearchTool as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            flashnetSearch: flashnetSearchTool as any,
        });
        return { ...sparkRest, ...flashnetRest, researchSearch } as ToolSet;
    };

    return {
        getExtras: () => {
            if (closed) return Promise.resolve({} as ToolSet);
            if (!cached) cached = open();
            return cached;
        },
        close: async () => {
            if (closed) return;
            closed = true;
            if (!opened) return;
            // Wait for any in-flight open before closing so we don't leak
            // a half-initialized client.
            try {
                await cached;
            } catch {
                // open() already logs; we just need to proceed to close.
            }
            await Promise.allSettled(clients.map((c) => c?.close()));
        },
    };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Both `sessionId` (from the request body) and `X-POSTHOG-SESSION-ID` (from
 * headers) are client-controlled. They become $ai_trace_id / $ai_session_id /
 * $session_id, so an unvalidated string could poison traces or blow up the
 * cardinality of PostHog property values. Accept only canonical UUID form;
 * the caller falls back to crypto.randomUUID() or drops the field otherwise.
 */
function asValidUuid(value: unknown): string | undefined {
    return typeof value === 'string' && value.length === 36 && UUID_RE.test(value) ? value : undefined;
}

async function fetchNetworkContext(): Promise<string> {
    try {
        const stats = await sparkscanFetch<NetworkSummary>('/v2/stats/summary');
        return `Network: TVL $${(stats.totalValueLockedUsd / 1e6).toFixed(1)}M (${stats.totalValueLockedSats.toLocaleString()} sats), ${stats.activeAccounts.toLocaleString()} active accounts, ${stats.transactions24h.toLocaleString()} txs in 24h, BTC $${stats.currentBtcPriceUsd.toLocaleString()}.`;
    } catch {
        return 'Network stats unavailable.';
    }
}

async function buildSharedContext(): Promise<{
    catalogPrompt: string;
    networkContext: string;
    timeContext: string;
}> {
    const [catalogModule, networkContext] = await Promise.all([import('@/lib/catalog'), fetchNetworkContext()]);
    const catalogPrompt = catalogModule.catalog.prompt();
    const timeContext = `Current time: ${new Date().toISOString()} (UTC). User timezone is provided in messages via [Timezone: ...].`;
    return { catalogPrompt, networkContext, timeContext };
}

async function buildOrchestratorSystemPrompt(): Promise<string> {
    const { catalogPrompt, networkContext, timeContext } = await buildSharedContext();
    return `You are the orchestrator for Sparky, a Spark blockchain analyst and explorer assistant.

## Session Context
${timeContext}
${networkContext}

## Your Job
You decide what to fetch and how to handle each request. For analytical or multi-source synthesis, you DELEGATE the user-facing response to the \`delegateToWriter\` tool. For trivial display requests and direct on-screen answers, you respond yourself.

## Decision Flow (follow this for EVERY request)

1. **Check on-screen context first.** If [Currently displayed on screen: ...] contains the data the user is asking about, answer directly from it. Do NOT re-fetch and do NOT delegate.
2. **Can a UI component handle the display request?** For pure display requests ("show me X", "list Y"), output a component spec and END. Do NOT delegate. Components self-fetch their data.
3. **Does the request need analysis or synthesis?** Gather the data via tools and/or subagents (\`deepAnalysis\`, \`parallelAnalysis\`), then call \`delegateToWriter\` with everything you gathered. Do NOT write the response yourself in this case.

## Outputting UI Components (trivial path only)
Components self-fetch. Just output the spec — no leading/trailing text:

- "Show me the latest transactions" → LatestTransactions
- "Look up address sp1..." → AddressSummary
- "Show me token USDB" → TokenDetail
- "Who holds token X?" → TokenHolders
- "What tokens does sp1... hold?" → AddressTokens
- "Show me all tokens" → TokenList
- "Who are the top wallets?" → WalletLeaderboard
- "Show me the top tokens" → TokenLeaderboard
- "Show me Flashnet pools" → FlashnetPools
- "Show me pool details for X" → FlashnetPoolDetail
- "Show me Flashnet host X" → FlashnetHostDetail

${catalogPrompt}

## Subagent Delegation (data gathering)

For complex analytical questions that need 3+ tool calls or cross-referencing multiple data sources, gather via a subagent:

- \`deepAnalysis\` — single-entity drill-down (one address/token/pool/wallet, multiple tool calls).
- \`parallelAnalysis\` — multi-entity comparison/aggregation (2-6 entities, each analyzed concurrently).

Each subagent has Sparkscan + Flashnet tools, web research, and docs MCPs. Returns structured analysis.

After the subagent(s) return, call \`delegateToWriter\` to produce the user-facing response — do NOT write it yourself.

## Using Tools (data gathering)

Tools are for gathering data the orchestrator or writer needs. They are NOT for displaying data (use components for that).

CRITICAL RULES:
- For analytical questions, after gathering data with tools, you MUST call \`delegateToWriter\` to produce the user-facing response.
- Call the FEWEST tools possible. Most analytical questions need only 1-2 tools or one subagent.
- If on-screen context already has the answer, do NOT call any tools and do NOT delegate — answer directly.
- Never call the same tool twice with different parameters hoping for better results.

## Calling delegateToWriter

When you've gathered the data, call \`delegateToWriter\` with:
- \`brief\`: 2-4 sentences directing the writer (tone, structure, what to emphasize, which components to consider). Under 500 chars.
- \`user_query\`: the user's original question, verbatim.
- \`on_screen_context\`: the current on-screen state if any (copy from \`[Currently displayed on screen: ...]\`).
- \`findings\`: an array of \`{ source, data }\`. \`source\` is the tool/subagent name; \`data\` is the full JSON or markdown result. Include EVERY tool/subagent result the writer needs — the writer is stateless and sees nothing else.

After calling \`delegateToWriter\`, your turn is over. Do NOT write any text or call any more tools.

## On-Screen Context

User messages include \`[Currently displayed on screen: ...]\` describing what components and data are visible. This is the ground truth for what the user sees.

## Flashnet AMM
Flashnet is an AMM protocol. Use Flashnet tools/components for liquidity pools, trading fees, hosts, and simulations.

## Viewport Awareness
\`[Viewport: ~Xpx height, ~N rows]\` — match \`limit\` props to visible rows.

## Sorting, Filtering & Time Ranges
- LatestTransactions / AddressTransactions: sort (created_at|updated_at), order (asc|desc), fromTimestamp/toTimestamp (ISO 8601). AddressTransactions also supports asset filter.
- TokenList: sort (holders|updated_at|created_at|supply), sortDirection (asc|desc), hasIcon, minHolders.
- WalletLeaderboard / TokenLeaderboard: limit (1-100), sort options.

## Layout & Sizing (trivial path only)

Grid + GridItem for multi-component layouts (colSpan 12 = full, 6 = half, 4 = third, 3 = quarter).

For trivial component-only responses: prefer \`layout: "inline"\` for single cards/charts/details. Use \`layout: "panel"\` only for scrollable tables, multi-component Grids, or flow diagrams.

## Trivial-Path Response Rules

When you respond directly (NOT via delegateToWriter), end with the suggestions line:
\`[suggestions: "question 1", "question 2", "question 3"]\`

Exactly 3 questions, each in double quotes, all wrapped in \`[suggestions: ...]\`. Each under 50 characters. Use full identifiers; never truncate with "...".

When you delegate, the writer handles suggestions — do NOT add them yourself.`;
}

async function buildWriterSystemPrompt(): Promise<string> {
    const { catalogPrompt, networkContext, timeContext } = await buildSharedContext();
    return `You are the writer agent for Sparky, a Spark blockchain analyst and explorer assistant. The orchestrator has already gathered data and is delegating the user-facing response to you.

## Session Context
${timeContext}
${networkContext}

## Your Job
Synthesize the gathered findings into a clear, well-formatted response. You have NO TOOLS — work only from the brief and findings the orchestrator passed you. You CAN emit json-render component specs to render data visually.

## Inputs You Receive

The orchestrator's prompt to you contains:
- The original user question
- A short brief on what to write
- (Optional) on-screen context describing what the user can already see
- A \`findings\` section with all gathered tool/subagent results

Use the brief as guidance, not gospel — the user's question is the ground truth.

${catalogPrompt}

## Outputting UI Components

You can emit json-render component specs alongside text when they help. Catalog above shows what's available. Pure prose is fine if a component wouldn't add value.

## Layout & Sizing

Grid + GridItem for multi-component layouts (colSpan 12 = full, 6 = half, 4 = third, 3 = quarter).

### Component Approximate Heights
| Component | Approx Height |
|-----------|--------------|
| AddressSummary | ~120px |
| TokenDetail / FlashnetHostDetail | ~150px |
| FlashnetPoolDetail | ~200px |
| Chart (any) | ~300px |
| Table (any, per row ~40px) | ~200-600px |
| TransactionFlow | ~400px |
| Grid of above | sum of children |

### Deciding \`layout\`
Set \`layout\` on the root component. Default to \`inline\` — only use \`panel\` when the content needs a scrollable side panel.

- \`"inline"\` — single cards, stats, summaries, charts, detail views.
- \`"panel"\` — scrollable data tables (many rows), multi-component Grids combining tables with other content, or flow diagrams.

Never put a small card in the panel.

## Analysis Style

- Compute and surface derived metrics: ratios, distributions, percentages.
- Use **bold** for key findings, bullet lists, ## headers.
- Format numbers: $10.5M, 177K accounts, 3,984 txs.
- Include full addresses and token tickers when mentioning them.
- Be concise. Don't pad. Don't repeat what a component already shows.

## Output Discipline

- Don't echo back the brief or findings as if quoting them.
- Don't add filler like "based on the data gathered" or "here is the summary".
- If a component will display data, don't list the same data in text underneath.

## Follow-up Suggestions (MANDATORY)
End EVERY response with one line in this format:
\`[suggestions: "question 1", "question 2", "question 3"]\`

Rules:
- Exactly 3 questions, comma-separated, each in double quotes, all wrapped in \`[suggestions: ...]\`.
- Each question under 50 characters.
- Do NOT render suggestions any other way — bracketed line is the ONLY format, exactly once, as the final line.
- Use full identifiers (addresses, tx IDs); never truncate with "...".
- Component-only responses end with just the suggestions line on its own — no description text before it.

Never output a response without the bracketed suggestions line as the last line.`;
}

export async function POST(req: NextRequest) {
    try {
        const cookieName = `ph_${env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN}_posthog`;
        const cookieValue = req.cookies.get(cookieName)?.value;
        const distinctId = cookieValue ? JSON.parse(cookieValue).distinct_id : undefined;
        const phSessionId = asValidUuid(req.headers.get('x-posthog-session-id'));

        const { messages, sessionId: rawSessionId, clientContext } = await req.json();
        const sessionId = asValidUuid(rawSessionId);

        const userQuery =
            messages.at(-1)?.parts?.find((p: { type: string }) => p.type === 'text')?.text ?? messages.at(-1)?.content;

        const modelMessages = await convertToModelMessages(messages);

        // Build client context hints to append to the system prompt
        const contextHints: string[] = [];
        if (clientContext?.viewport) {
            contextHints.push(
                `[Viewport: ~${clientContext.viewport.height}px height, ~${clientContext.viewport.visibleRows} table rows visible]`,
            );
        }
        if (clientContext?.timezone) {
            contextHints.push(`[Timezone: ${clientContext.timezone}]`);
        }
        if (clientContext?.onScreen) {
            contextHints.push(`[Currently displayed on screen:\n${clientContext.onScreen}\n]`);
        }

        const model = await getModel('orchestrator');
        const posthog = posthogClient();
        // Use the client's chat session id as the trace id so every turn in a
        // conversation lands inside the same trace in LLM Observability.
        const traceId = sessionId ?? crypto.randomUUID();
        // Mirror @posthog/ai's captureAiGeneration: when no cookie distinctId
        // is available, fall back to traceId so the manual $ai_trace lands
        // alongside the $ai_generation events (PostHog groups by distinct_id
        // + $ai_trace_id), and set $process_person_profile: false so an
        // anonymous chat session doesn't mint a Person profile keyed by a
        // synthetic id.
        const effectiveDistinctId = distinctId ?? traceId;
        const anonymousProfileSuppression = distinctId ? {} : { $process_person_profile: false };
        const baseProperties = {
            ...(sessionId ? { $ai_session_id: sessionId } : {}),
            ...(phSessionId ? { $session_id: phSessionId } : {}),
        };

        // Emit a $ai_trace root for this turn so PostHog names/groups the
        // conversation in LLM Observability. Re-emitting per turn with the
        // same $ai_trace_id is intentional — it keeps the trace named by the
        // latest user query while grouping every generation under one trace.
        const queryPreview = userQuery ? String(userQuery).slice(0, 100) : 'chat';
        posthog.capture({
            distinctId: effectiveDistinctId,
            event: '$ai_trace',
            properties: {
                $ai_trace_id: traceId,
                $ai_span_name: queryPreview,
                ...baseProperties,
                ...anonymousProfileSuppression,
            },
        });

        const tracedModel = withTracing(model, posthog, {
            posthogDistinctId: distinctId,
            posthogTraceId: traceId,
            posthogProperties: {
                $ai_span_name: 'main-agent',
                ...baseProperties,
            },
        });

        const [orchestratorSystemPrompt, writerSystemPrompt] = await Promise.all([
            buildOrchestratorSystemPrompt(),
            buildWriterSystemPrompt(),
        ]);
        const fullSystem =
            contextHints.length > 0
                ? `${orchestratorSystemPrompt}\n\n## Current Client State\n${contextHints.join('\n')}`
                : orchestratorSystemPrompt;

        // Worker model serves both deepAnalysis and parallelAnalysis subagents.
        // Each subagent type gets its own withTracing wrap so PostHog distinguishes
        // their spans while sharing the parent traceId.
        const workerModel = await getModel('worker');
        const tracedDeepAnalysisModel = withTracing(workerModel, posthog, {
            posthogDistinctId: distinctId,
            posthogTraceId: traceId,
            posthogProperties: {
                $ai_span_name: 'deep-analysis-subagent',
                ...baseProperties,
            },
        });
        const tracedParallelAnalysisModel = withTracing(workerModel, posthog, {
            posthogDistinctId: distinctId,
            posthogTraceId: traceId,
            posthogProperties: {
                $ai_span_name: 'parallel-analysis-subagent',
                ...baseProperties,
            },
        });
        const workerProviderOptions = getProviderOptions('worker');

        // Writer model — handles the user-facing synthesis when the orchestrator
        // delegates via `delegateToWriter`. Trivial direct-render turns bypass it.
        const writerModel = await getModel('writer');
        const tracedWriterModel = withTracing(writerModel, posthog, {
            posthogDistinctId: distinctId,
            posthogTraceId: traceId,
            posthogProperties: {
                $ai_span_name: 'writer',
                ...baseProperties,
            },
        });
        const writerProviderOptions = getProviderOptions('writer');

        // Lazy MCP wiring: connecting to the docs MCPs and listing their
        // tools is deferred until the first subagent invocation. Simple
        // display/component queries that never trigger deepAnalysis or
        // parallelAnalysis don't pay the docs MCP latency, and a slow docs
        // server can't delay first token. Defining cleanup immediately —
        // before any further awaits — guarantees the outer catch can close
        // anything that did get opened.
        const mcpExtras = createMcpExtras({ rerankModelId: env.MODEL_RERANK });
        let cleanedUp = false;
        const cleanup = async () => {
            if (cleanedUp) return;
            cleanedUp = true;
            await mcpExtras.close();
            await posthog.shutdown();
        };

        try {
            // Pipe through json-render transform to classify text vs JSONL patches.
            // Tools are constructed inside execute() so they can call writer.write()
            // to emit `data-subagentStep` parts while their internal loop runs.
            const stream = createUIMessageStream({
                execute: async ({ writer }) => {
                    const emitStep = (event: SubagentStepEvent) => {
                        writer.write({ type: 'data-subagentStep', data: event });
                    };
                    const deepAnalysis = createDeepAnalysisTool(
                        tracedDeepAnalysisModel,
                        workerProviderOptions,
                        mcpExtras.getExtras,
                        emitStep,
                    );
                    const parallelAnalysis = createParallelAnalysisTool(
                        tracedParallelAnalysisModel,
                        workerProviderOptions,
                        mcpExtras.getExtras,
                        emitStep,
                    );
                    const delegateToWriter = createDelegateToWriterTool(
                        tracedWriterModel,
                        writerSystemPrompt,
                        writerProviderOptions,
                        writer,
                    );

                    const result = streamText({
                        model: tracedModel,
                        system: fullSystem,
                        messages: modelMessages,
                        tools: {
                            ...sparkscanTools,
                            ...flashnetTools,
                            deepAnalysis,
                            parallelAnalysis,
                            delegateToWriter,
                        },
                        stopWhen: [stepCountIs(5), hasToolCall('delegateToWriter')],
                        onFinish: cleanup,
                        onError: ({ error }) => {
                            console.error('[chat] stream error:', error);
                            void cleanup();
                        },
                    });

                    writer.merge(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        result.toUIMessageStream().pipeThrough(createJsonRenderTransform()) as any,
                    );
                },
            });

            return createUIMessageStreamResponse({ stream });
        } catch (streamError) {
            // Synchronous stream-setup error — cleanup MCP clients before rethrowing.
            await cleanup();
            throw streamError;
        }
    } catch (error) {
        console.error('Chat API error:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return Response.json({ error: message }, { status: 500 });
    }
}

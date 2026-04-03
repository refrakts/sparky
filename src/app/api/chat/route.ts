import { createJsonRenderTransform } from '@json-render/core';
import { withTracing } from '@posthog/ai';
import {
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    gateway,
    type LanguageModelMiddleware,
    stepCountIs,
    streamText,
    wrapLanguageModel,
} from 'ai';
import type { NextRequest } from 'next/server';
import { sparkscanFetch } from '@/lib/api';
import posthogClient from '@/lib/posthog';
import { createDeepAnalysisTool, flashnetTools, sparkscanTools } from '@/lib/tools';
import type { NetworkSummary } from '@/lib/types';

async function getDevToolsMiddleware(): Promise<LanguageModelMiddleware | undefined> {
    if (process.env.NODE_ENV !== 'development') return undefined;
    try {
        const { devToolsMiddleware } = await import('@ai-sdk/devtools');
        return devToolsMiddleware();
    } catch {
        return undefined;
    }
}

let modelPromise: ReturnType<typeof createModel> | null = null;

async function createModel() {
    const middleware = await getDevToolsMiddleware();
    if (middleware) {
        return wrapLanguageModel({
            model: gateway('moonshotai/kimi-k2.5'),
            middleware,
        });
    }
    return gateway('moonshotai/kimi-k2.5');
}

function getModel() {
    if (!modelPromise) modelPromise = createModel();
    return modelPromise;
}

export const maxDuration = 60;

async function fetchNetworkContext(): Promise<string> {
    try {
        const stats = await sparkscanFetch<NetworkSummary>('/v2/stats/summary');
        return `Network: TVL $${(stats.totalValueLockedUsd / 1e6).toFixed(1)}M (${stats.totalValueLockedSats.toLocaleString()} sats), ${stats.activeAccounts.toLocaleString()} active accounts, ${stats.transactions24h.toLocaleString()} txs in 24h, BTC $${stats.currentBtcPriceUsd.toLocaleString()}.`;
    } catch {
        return 'Network stats unavailable.';
    }
}

async function buildSystemPrompt(): Promise<string> {
    const [catalogModule, networkContext] = await Promise.all([import('@/lib/catalog'), fetchNetworkContext()]);
    const catalogPrompt = catalogModule.catalog.prompt();

    const timeContext = `Current time: ${new Date().toISOString()} (UTC). User timezone is provided in messages via [Timezone: ...].`;

    return `You are a Spark blockchain analyst and explorer assistant for Sparky.

## Session Context
${timeContext}
${networkContext}

## Decision Flow (follow this for EVERY request)

1. **Check on-screen context first.** If [Currently displayed on screen: ...] contains the data the user is asking about, answer directly from it. Do NOT re-fetch data the user can already see.
2. **Can a UI component handle it?** For display requests ("show me X", "list Y"), output a component spec. Components self-fetch their data — you never need to call a tool for them.
3. **Do you need to analyze or compute?** Only then use tools. Call the minimum tools needed (usually 1-2), then IMMEDIATELY write your analysis. Never call more tools than necessary.

## Outputting UI Components
Components self-fetch their data. Just output the spec:

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

## Layout & Sizing

Grid + GridItem for multi-component layouts (colSpan 12 = full, 6 = half, 4 = third, 3 = quarter).

### Component Approximate Heights
Use these to decide placement. The chat column is ~700px tall.

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
Set \`layout\` on the root component. Default to **inline** — only use panel when the content genuinely needs more space.
- **\`"inline"\`** — renders in the chat feed. Use for single cards, stats, summaries, charts, and detail views. Most components are fine inline.
- **\`"panel"\`** — opens a resizable side panel. Use ONLY for scrollable data tables (many rows), multi-component Grids combining tables with other content, or flow diagrams.

Rule of thumb: if it's a single self-contained component (even a chart or detail card), keep it inline. Only reach for the panel when the user would need to scroll through a large dataset.

### Mixing text + components
You can write text AND output a component in the same response. Text always appears inline in the chat. Use this for mixed responses:
- "What's token X?" → Write a brief text summary, then output \`TokenDetail\` with \`layout: "inline"\`.
- "Tell me about address X" → Write a brief text analysis, then output \`AddressSummary\` inline. If they also want transactions, output those in the panel.
- **Never put a small card in the panel.** Cards, stats, and charts belong inline.

Examples:
- AddressSummary alone → inline
- TokenDetail alone → inline
- TotalPlatformVolume alone → inline
- Any chart alone → inline
- TokenList or LatestTransactions → panel (table)
- "Tell me about token X" → text summary + TokenTransactions in panel
- Grid of 4 Charts → panel (~600px)

## Sorting, Filtering & Time Ranges
- **LatestTransactions / AddressTransactions**: sort (created_at|updated_at), order (asc|desc), fromTimestamp/toTimestamp (ISO 8601). AddressTransactions also supports asset filter.
- **TokenList**: sort (holders|updated_at|created_at|supply), sortDirection (asc|desc), hasIcon, minHolders.
- **WalletLeaderboard / TokenLeaderboard**: limit (1-100), sort options.

## Using Tools

Tools are for when you need raw data to answer a question, compute something, or compare entities. They are NOT for displaying data (use components for that).

**CRITICAL RULES:**
- After calling tool(s), you MUST write a text response summarizing what you found. The user CANNOT see raw tool results.
- Call the FEWEST tools possible. Most questions need only 1 tool call.
- If on-screen context already has the answer, do NOT call any tools.
- Never call the same tool twice with different parameters hoping for better results.

## Deep Analysis (Subagent)

For complex **analytical** questions that need **3+ tool calls** or cross-referencing multiple data sources, delegate to \`deepAnalysis\` instead of calling tools yourself. Examples:
- "Compare the top 5 tokens by holder concentration"
- "Analyze this address's trading patterns over time"
- "What's the relationship between these two wallets?"
- "Give me a full breakdown of Flashnet pool performance"

The subagent runs autonomously, calls as many tools as needed, and returns a structured analysis. You then relay its findings to the user (you may add components alongside).

**Do NOT use deepAnalysis when:**
- A UI component can handle it (e.g., "show me latest transactions" → just render LatestTransactions)
- A simple 1-2 tool call suffices
- The user is asking to display/show something (use components instead)

## On-Screen Context

User messages include \`[Currently displayed on screen: ...]\` describing what components and data are visible.

**This is the ground truth for what the user sees.** When they say "that first token" or "the top one", they mean what's on screen. Answer from this context — do NOT call tools to re-fetch it. Re-fetching may return different data and confuse the user.

## Flashnet AMM
Flashnet is an AMM protocol. Use Flashnet tools/components for liquidity pools, trading fees, hosts, and simulations.

## Viewport Awareness
\`[Viewport: ~Xpx height, ~N rows]\` — match \`limit\` props to visible rows.

## Analysis Style
- Compute derived metrics: ratios, distributions, percentages
- Use **bold** for key findings, bullet lists, ## headers
- Format numbers: $10.5M, 177K accounts, 3,984 txs

## Rules
- Components self-fetch. Don't use a tool if a component can display it.
- Include full addresses and token tickers when mentioning them.
- TransactionFlow is a **component** (not a tool). To show a flow, render a TransactionFlow component spec with the txid prop. ONLY use for token_multi_transfer transactions. Just render it, don't explain it.
- Be concise when outputting components. When using tools, always write a text summary.
- **Never re-fetch data a component already displays.** If you render LatestTransactions, don't also call getLatestTransactions — the component self-fetches.

## Follow-up Suggestions (MANDATORY)
You MUST end EVERY response with exactly 3 contextual follow-ups on the LAST line, even if your response is only a component with no text. In that case, write a brief one-line description followed by the suggestions line:
\`[suggestions: "question 1", "question 2", "question 3"]\`
Keep each under 50 characters. Always use **full** identifiers (addresses, tx IDs) in suggestions — never truncate with "...". If a full ID makes the suggestion too long, rephrase to avoid including it (e.g., "Show the multi-transfer flow" instead of "Show flow for abc123...").
**Never output a response without the suggestions line.**`;
}

export async function POST(req: NextRequest) {
    try {
        const cookieName = `ph_${process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN}_posthog`;
        const cookieValue = req.cookies.get(cookieName)?.value;
        const distinctId = cookieValue ? JSON.parse(cookieValue).distinct_id : undefined;

        const { messages, sessionId, clientContext } = await req.json();

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

        const model = await getModel();
        const posthog = posthogClient();
        const traceId = crypto.randomUUID();
        const baseProperties = {
            ...(sessionId ? { $ai_session_id: sessionId } : {}),
        };

        // Emit an explicit trace event so PostHog names and groups the trace
        const queryPreview = userQuery ? String(userQuery).slice(0, 100) : 'chat';
        posthog.capture({
            distinctId: distinctId ?? 'anonymous',
            event: '$ai_trace',
            properties: {
                $ai_trace_id: traceId,
                $ai_span_name: queryPreview,
                ...baseProperties,
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

        const systemPrompt = await buildSystemPrompt();
        const fullSystem =
            contextHints.length > 0
                ? `${systemPrompt}\n\n## Current Client State\n${contextHints.join('\n')}`
                : systemPrompt;

        // Subagent uses a separately traced model so its generations
        // appear under the same PostHog trace (shared traceId) for cost tracking.
        // $ai_span_name distinguishes subagent generations from the main agent.
        const tracedSubagentModel = withTracing(gateway('google/gemini-2.5-flash-lite'), posthog, {
            posthogDistinctId: distinctId,
            posthogTraceId: traceId,
            posthogProperties: {
                $ai_span_name: 'deep-analysis-subagent',
                ...baseProperties,
            },
        });
        const deepAnalysis = createDeepAnalysisTool(tracedSubagentModel);

        const result = streamText({
            model: tracedModel,
            system: fullSystem,
            messages: modelMessages,
            tools: {
                ...sparkscanTools,
                ...flashnetTools,
                deepAnalysis,
            },
            stopWhen: stepCountIs(5),
            onFinish: async () => {
                await posthog.shutdown();
            },
        });

        // Pipe through json-render transform to classify text vs JSONL patches
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                writer.merge(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result.toUIMessageStream().pipeThrough(createJsonRenderTransform()) as any,
                );
            },
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        console.error('Chat API error:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return Response.json({ error: message }, { status: 500 });
    }
}

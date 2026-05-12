import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
    server: {
        // Vercel AI Gateway — read by `gateway()` internally. On Vercel
        // it's set automatically via OIDC; only needed locally.
        AI_GATEWAY_API_KEY: z.string().optional(),

        // Firecrawl — used by subagent web-research tools (search/scrape/map).
        // Without it, those tools error at call time but the rest of the app runs fine.
        FIRECRAWL_API_KEY: z.string().optional(),

        // Upstream API base URLs.
        SPARKSCAN_API_URL: z.url().default('https://api.sparkscan.io'),
        FLASHNET_API_URL: z.url().default('https://api.flashnet.xyz'),

        // Documentation MCP servers — connected per-request by worker subagents
        // for cross-source research alongside Firecrawl web search. Failures
        // are non-fatal; the worker still has the other backends.
        SPARK_MCP_URL: z.url().default('https://docs.spark.money/mcp'),
        FLASHNET_MCP_URL: z.url().default('https://docs.flashnet.xyz/mcp'),

        // Per-role models for the AI Gateway. Any model the gateway accepts
        // works (e.g. `cohere/command-a`, `openai/gpt-5`, `openai/gpt-4o-mini`,
        // `mistral/mistral-large-latest`, `google/gemini-2.5-flash`,
        // `google/gemini-2.5-flash-lite`).
        MODEL_ORCHESTRATOR: z.string().default('cohere/command-a'),
        MODEL_WORKER: z.string().default('google/gemini-2.5-flash-lite'),

        // OpenAI reasoning effort for the worker subagent. Only applies when
        // the worker is an OpenAI reasoning model (o-series, gpt-5). Ignored
        // for non-OpenAI workers.
        WORKER_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).optional(),
    },
    client: {
        // Used by metadata, sitemap, robots. Dev fallback is localhost — prod
        // must override.
        NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().optional(),
        NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
        NEXT_PUBLIC_TABLE_DEBUG: z.string().optional(),
    },
    runtimeEnv: {
        AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
        SPARKSCAN_API_URL: process.env.SPARKSCAN_API_URL,
        FLASHNET_API_URL: process.env.FLASHNET_API_URL,
        SPARK_MCP_URL: process.env.SPARK_MCP_URL,
        FLASHNET_MCP_URL: process.env.FLASHNET_MCP_URL,
        MODEL_ORCHESTRATOR: process.env.MODEL_ORCHESTRATOR,
        MODEL_WORKER: process.env.MODEL_WORKER,
        WORKER_REASONING_EFFORT: process.env.WORKER_REASONING_EFFORT,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
        NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        NEXT_PUBLIC_TABLE_DEBUG: process.env.NEXT_PUBLIC_TABLE_DEBUG,
    },
});

import { gateway, type LanguageModelMiddleware, wrapLanguageModel } from 'ai';
import { env } from '@/env';

type ResolvedModel = ReturnType<typeof wrapLanguageModel>;

/**
 * Role-based model registry.
 *
 * Provider-agnostic: any model string the Vercel AI Gateway accepts
 * (`cohere/...`, `openai/...`, `mistral/...`, `google/...`, `anthropic/...`)
 * works for any role. Override per role via env vars; the defaults below
 * are the production picks.
 */
export type ModelRole = 'orchestrator' | 'worker';

const ROLE_MODELS: Record<ModelRole, string> = {
    orchestrator: env.MODEL_ORCHESTRATOR,
    worker: env.MODEL_WORKER,
};

export function getModelId(role: ModelRole): string {
    return ROLE_MODELS[role];
}

let devMiddlewarePromise: Promise<LanguageModelMiddleware | undefined> | null = null;

function getDevMiddleware(): Promise<LanguageModelMiddleware | undefined> {
    if (process.env.NODE_ENV !== 'development') return Promise.resolve(undefined);
    if (!devMiddlewarePromise) {
        devMiddlewarePromise = (async () => {
            try {
                const { devToolsMiddleware } = await import('@ai-sdk/devtools');
                return devToolsMiddleware();
            } catch {
                return undefined;
            }
        })();
    }
    return devMiddlewarePromise;
}

const cache = new Map<ModelRole, Promise<ResolvedModel>>();

export function getModel(role: ModelRole): Promise<ResolvedModel> {
    const cached = cache.get(role);
    if (cached) return cached;
    const created = (async (): Promise<ResolvedModel> => {
        const middleware = await getDevMiddleware();
        const base = gateway(getModelId(role));
        return middleware ? wrapLanguageModel({ model: base, middleware }) : base;
    })();
    cache.set(role, created);
    return created;
}

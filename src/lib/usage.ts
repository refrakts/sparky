/**
 * Usage tracking and quota enforcement.
 *
 * In v1, this uses in-memory storage. Replace with a Postgres-backed
 * implementation (usage_log table) when DATABASE_URL is configured.
 */

const PLAN_LIMITS: Record<string, number> = {
    free: 50,
    pro: 1000,
    team: 10000,
};

interface UsageEntry {
    userId: string;
    sessionId?: string;
    createdAt: Date;
    userQuery?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    llmCostUsd: number;
    toolName?: string;
}

// In-memory store — replace with DB in production
const usageLog: UsageEntry[] = [];

function calculateCost(usage: { promptTokens: number; completionTokens: number }): number {
    // gpt-4o-mini pricing (approximate)
    const inputCostPer1k = 0.00015;
    const outputCostPer1k = 0.0006;
    return (usage.promptTokens / 1000) * inputCostPer1k + (usage.completionTokens / 1000) * outputCostPer1k;
}

export async function checkQuota(userId: string, plan: string = 'free'): Promise<boolean> {
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const count = usageLog.filter((e) => e.userId === userId && e.createdAt >= monthStart).length;

    return count < limit;
}

export async function logUsage(entry: {
    userId: string;
    sessionId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    toolName?: string;
    userQuery?: string;
}): Promise<void> {
    usageLog.push({
        ...entry,
        createdAt: new Date(),
        llmCostUsd: calculateCost({
            promptTokens: entry.inputTokens,
            completionTokens: entry.outputTokens,
        }),
    });
}

export function getUsageCount(userId: string): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return usageLog.filter((e) => e.userId === userId && e.createdAt >= monthStart).length;
}

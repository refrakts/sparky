// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { delegateToWriterInputSchema } from './tools';

describe('delegateToWriter input schema', () => {
    const schema = delegateToWriterInputSchema;

    it('accepts a complete payload', () => {
        const result = schema.safeParse({
            brief: 'Summarize top tokens',
            user_query: 'Rank the top 5 tokens',
            on_screen_context: 'Showing TokenLeaderboard',
            findings: [{ source: 'parallelAnalysis', data: '## JOY\n...' }],
        });
        expect(result.success).toBe(true);
    });

    it('accepts a payload without optional on_screen_context', () => {
        const result = schema.safeParse({
            brief: 'Summarize',
            user_query: 'Rank',
            findings: [{ source: 'getTokenLeaderboard', data: '{}' }],
        });
        expect(result.success).toBe(true);
    });

    it('rejects empty findings array', () => {
        const result = schema.safeParse({
            brief: 'Summarize',
            user_query: 'Rank',
            findings: [],
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing brief', () => {
        const result = schema.safeParse({
            user_query: 'Rank',
            findings: [{ source: 's', data: 'd' }],
        });
        expect(result.success).toBe(false);
    });

    it('rejects findings entries missing source or data', () => {
        const result = schema.safeParse({
            brief: 'Summarize',
            user_query: 'Rank',
            findings: [{ source: 'parallelAnalysis' }],
        });
        expect(result.success).toBe(false);
    });
});

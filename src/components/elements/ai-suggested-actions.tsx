'use client';

import { cn } from '@/lib/utils';

interface Suggestion {
    label: string;
    prompt: string;
}

interface AiSuggestedActionsProps {
    suggestions: Suggestion[];
    onSelect?: (prompt: string) => void;
    className?: string;
}

function AiSuggestedActions({ suggestions, onSelect, className }: AiSuggestedActionsProps) {
    return (
        <div
            data-slot="ai-suggested-actions"
            className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}
        >
            {suggestions.map((suggestion) => (
                <button
                    type="button"
                    key={suggestion.prompt}
                    onClick={() => onSelect?.(suggestion.prompt)}
                    className="whitespace-nowrap rounded-full border border-border/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    {suggestion.label}
                </button>
            ))}
        </div>
    );
}

export type { AiSuggestedActionsProps, Suggestion };
export { AiSuggestedActions };

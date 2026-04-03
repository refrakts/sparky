'use client';

import { Renderer, useJsonRenderMessage } from '@json-render/react';
import type { UIMessage } from 'ai';
import { ExternalLink } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AiSuggestedActions } from '@/components/elements/ai-suggested-actions';
import { useDataCache } from '@/lib/data-cache';
import { registry } from '@/lib/registry';
import { useChatPanel } from './chat-panel';

interface MessageRendererProps {
    message: UIMessage;
    isStreaming?: boolean;
    onSuggestionClick?: (text: string) => void;
}

const SUGGESTIONS_RE = /\[suggestions:\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]\s*$/;
/** Match a trailing partial `[suggestions: ...]` block (requires at least `[suggest` to avoid stripping normal brackets) */
const SUGGESTIONS_PARTIAL_RE = /\[suggest(?:i(?:o(?:n(?:s(?::[\s\S]*)?)?)?)?)?\s*$/;

function parseSuggestions(text: string): { cleanText: string; suggestions: string[] } {
    const match = text.match(SUGGESTIONS_RE);
    if (!match) return { cleanText: text, suggestions: [] };
    return {
        cleanText: text.replace(SUGGESTIONS_RE, '').trimEnd(),
        suggestions: [match[1], match[2], match[3]],
    };
}

function stripPartialSuggestions(text: string): string {
    return text.replace(SUGGESTIONS_PARTIAL_RE, '').trimEnd();
}

function PonderingIndicator() {
    return (
        <div className="flex items-center gap-1.5 py-3">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
        </div>
    );
}

/**
 * Populates the data cache with tool results from message parts.
 */
function usePopulateDataCache(parts: UIMessage['parts']) {
    const cache = useDataCache();
    const processedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        for (const part of parts) {
            if (!part.type.startsWith('tool-')) continue;
            const toolPart = part as any;
            const toolName = part.type.replace('tool-', '');
            const isDone = toolPart.state === 'output-available' || toolPart.state === 'result';
            if (!isDone || !toolPart.output) continue;

            const cacheKey = toolPart.toolCallId ?? `${toolName}-${Date.now()}`;
            if (processedRef.current.has(cacheKey)) continue;
            processedRef.current.add(cacheKey);

            cache.set(cacheKey, toolName, toolPart.output);
        }
    }, [parts, cache]);
}

/** Convert camelCase tool name to human-readable label */
function toolLabel(name: string): string {
    return (
        name
            .replace(/^get/, '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/^./, (c) => c.toUpperCase())
            .trim() || name
    );
}

function ToolCallItem({ part }: { part: Record<string, unknown> }) {
    const [expanded, setExpanded] = useState(false);
    const toolName = String(part.toolName ?? (part.type as string).replace('tool-', ''));
    const isDone = part.state === 'output-available' || part.state === 'result';
    const output = part.output as Record<string, unknown> | undefined;

    return (
        <div className="rounded-lg border bg-muted/50 text-xs">
            <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                onClick={() => isDone && output && setExpanded(!expanded)}
            >
                {isDone ? (
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-600 dark:text-green-400 shrink-0"
                    >
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                ) : (
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="animate-spin text-muted-foreground shrink-0"
                    >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                )}
                <span className="font-medium text-muted-foreground">{toolLabel(toolName)}</span>
                {isDone && output && (
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`ml-auto text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                )}
            </button>
            {expanded && output && (
                <div className="border-t px-3 py-2 max-h-48 overflow-auto">
                    <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                        {JSON.stringify(output, null, 2).slice(0, 2000)}
                    </pre>
                </div>
            )}
        </div>
    );
}

function ToolCallDisplay({ parts }: { parts: UIMessage['parts'] }) {
    const toolParts = parts.filter((p) => p.type.startsWith('tool-'));
    if (toolParts.length === 0) return null;

    return (
        <div className="space-y-1.5">
            {toolParts.map((part, i) => (
                <ToolCallItem key={i} part={part as any} />
            ))}
        </div>
    );
}

/** Inline preview card shown in chat when spec content is sent to the panel */
function SpecPreviewCard({ title, onClick }: { title: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60"
        >
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-medium">{title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">View</span>
        </button>
    );
}

/** Components that are large enough to warrant the side panel by default */
const DEFAULT_PANEL_COMPONENTS = new Set([
    'LatestTransactions',
    'AddressTransactions',
    'TokenTransactions',
    'TokenHolders',
    'TokenList',
    'WalletLeaderboard',
    'TokenLeaderboard',
    'FlashnetPools',
    'TransactionFlow',
]);

/**
 * Walk a spec and all its elements, checking if any node matches a predicate.
 * Handles both resolved tree specs (nested children) and flat element-map specs.
 */
function specTreeHas(spec: any, predicate: (node: any) => boolean): boolean {
    if (!spec) return false;

    // Check the root node itself
    if (predicate(spec)) return true;

    // Flat element map (raw JSON Render spec shape: { elements: { id: { type, props, children } } })
    if (spec.elements && typeof spec.elements === 'object') {
        return Object.values(spec.elements).some((el: any) => el && predicate(el));
    }

    // Resolved tree with nested children
    if (Array.isArray(spec.children)) {
        return spec.children.some((child: any) => (typeof child === 'object' ? specTreeHas(child, predicate) : false));
    }

    return false;
}

/**
 * Determine whether a spec should render inline or in the side panel.
 *
 * Walks the entire spec tree — if ANY node is a panel component or has
 * `layout: "panel"`, the whole spec goes to the panel. This handles
 * cases where the LLM wraps a TokenList inside Grid > GridItem.
 */
function shouldRenderInline(spec: any): boolean {
    if (!spec) return false;

    // If any node in the tree is a known-large component → panel
    if (specTreeHas(spec, (n) => DEFAULT_PANEL_COMPONENTS.has(n.type))) return false;

    // If any node has layout: "panel" → panel
    if (specTreeHas(spec, (n) => n.props?.layout === 'panel')) return false;

    // If the root explicitly says inline → inline
    if (spec.props?.layout === 'inline') return true;

    // Default: inline
    return true;
}

export function MessageRenderer({ message, isStreaming, onSuggestionClick }: MessageRendererProps) {
    const { spec, hasSpec } = useJsonRenderMessage(message.parts as any[]);
    const { openPanel } = useChatPanel();

    // Populate data cache with tool results
    usePopulateDataCache(message.parts);

    const rawText = message.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('');

    const { cleanText: textContent, suggestions } = isStreaming
        ? { cleanText: stripPartialSuggestions(rawText), suggestions: [] }
        : parseSuggestions(rawText);

    const toolParts = message.parts.filter((p) => p.type.startsWith('tool-'));
    const allToolsDone =
        toolParts.length > 0 &&
        toolParts.every((p) => {
            const state = (p as any).state;
            return state === 'output-available' || state === 'result';
        });
    // Show pondering when: streaming with no text/spec, AND either no tools yet or all tools finished (model is thinking)
    const showPondering = isStreaming && !textContent && !hasSpec && (toolParts.length === 0 || allToolsDone);

    // Derive a title from the spec for the panel header
    const specTitle =
        hasSpec && spec
            ? ((spec as { type?: string }).type?.replace(/([a-z])([A-Z])/g, '$1 $2') ?? 'Result')
            : 'Result';

    const inline = hasSpec && spec ? shouldRenderInline(spec) : false;

    const openSpecInPanel = () => {
        if (!hasSpec || !spec) return;
        openPanel(<Renderer spec={spec} registry={registry} />, specTitle);
    };

    // Auto-open panel when a non-inline spec becomes available
    const lastOpenedSpecRef = useRef<unknown>(null);
    useEffect(() => {
        if (hasSpec && spec && !isStreaming && !inline && spec !== lastOpenedSpecRef.current) {
            lastOpenedSpecRef.current = spec;
            openPanel(<Renderer spec={spec} registry={registry} />, specTitle);
        }
    }, [hasSpec, spec, isStreaming, openPanel, specTitle, inline]);

    return (
        <div className="space-y-3">
            <ToolCallDisplay parts={message.parts} />

            <AnimatePresence>
                {showPondering && (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <PonderingIndicator />
                    </motion.div>
                )}
            </AnimatePresence>

            {textContent && (
                <div className="prose prose-sm dark:prose-invert [&>*:first-child]:mt-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
                </div>
            )}

            {/* Simple specs render inline */}
            {hasSpec && spec && !isStreaming && inline && (
                <div className="w-full">
                    <Renderer spec={spec} registry={registry} />
                </div>
            )}

            {/* Complex specs show a preview card and open in the panel */}
            {hasSpec && spec && !isStreaming && !inline && (
                <SpecPreviewCard title={specTitle} onClick={openSpecInPanel} />
            )}

            {/* During streaming, always render inline */}
            {hasSpec && spec && isStreaming && (
                <div className="w-full">
                    <Renderer spec={spec} registry={registry} loading />
                </div>
            )}

            <AnimatePresence>
                {suggestions.length > 0 && onSuggestionClick && (
                    <motion.div
                        key="suggestions"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                    >
                        <AiSuggestedActions
                            suggestions={suggestions.map((s) => ({ label: s, prompt: s }))}
                            onSelect={(prompt) => onSuggestionClick(prompt)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

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
import type { SubagentStepEvent } from '@/lib/tools';
import { useChatPanel } from './chat-panel';

interface SpecNode {
    type?: string;
    props?: {
        layout?: 'inline' | 'panel' | string;
        [key: string]: unknown;
    };
    elements?: Record<string, SpecNode>;
    children?: unknown[];
}

interface ToolPart extends Record<string, unknown> {
    type: string;
    toolCallId?: string;
    toolName?: string;
    state?: string;
    output?: unknown;
}

interface SubagentStepPart {
    type: 'data-subagentStep';
    data: SubagentStepEvent;
}

const SUBAGENT_TOOLS = new Set(['deepAnalysis', 'parallelAnalysis']);

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
            const toolPart = part as ToolPart;
            const toolName = toolPart.toolName ?? part.type.replace('tool-', '');
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

function SubagentStepRows({ steps }: { steps: SubagentStepEvent[] }) {
    const ordered = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
    return (
        <ol className="space-y-2">
            {ordered.map((step) => {
                const toolList =
                    step.toolCalls.length > 0 ? step.toolCalls.map((c) => toolLabel(c.name)).join(', ') : 'Thinking';
                return (
                    <li key={`${step.subtaskId ?? ''}-${step.stepIndex}`} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                        <div className="min-w-0 flex-1">
                            <div className="font-medium text-muted-foreground">{toolList}</div>
                            {step.summary && (
                                <div className="mt-0.5 truncate text-muted-foreground/70">{step.summary}</div>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

function SubagentStepList({ steps, isParallel }: { steps: SubagentStepEvent[]; isParallel: boolean }) {
    if (!isParallel) return <SubagentStepRows steps={steps} />;
    const groups = new Map<string, SubagentStepEvent[]>();
    for (const step of steps) {
        const id = step.subtaskId ?? '';
        const arr = groups.get(id) ?? [];
        arr.push(step);
        groups.set(id, arr);
    }
    return (
        <div className="space-y-3">
            {Array.from(groups.entries()).map(([id, branchSteps]) => (
                <div key={id}>
                    {id && (
                        <div className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                            {id}
                        </div>
                    )}
                    <SubagentStepRows steps={branchSteps} />
                </div>
            ))}
        </div>
    );
}

function ToolCallItem({ part, steps }: { part: ToolPart; steps?: SubagentStepEvent[] }) {
    const toolName = String(part.toolName ?? part.type.replace('tool-', ''));
    const isSubagent = SUBAGENT_TOOLS.has(toolName);
    const isDone = part.state === 'output-available' || part.state === 'result';
    const output = part.output as Record<string, unknown> | undefined;
    const stepCount = steps?.length ?? 0;

    // Subagent tools: auto-expanded while running, auto-collapse on completion.
    // Other tools: collapsed by default; user expands to inspect JSON output.
    const [expanded, setExpanded] = useState(isSubagent ? !isDone : false);
    const prevIsDoneRef = useRef(isDone);
    useEffect(() => {
        if (isSubagent && !prevIsDoneRef.current && isDone) {
            setExpanded(false);
        }
        prevIsDoneRef.current = isDone;
    }, [isSubagent, isDone]);

    const expandable = isSubagent ? stepCount > 0 : isDone && !!output;

    return (
        <div className="rounded-lg border bg-muted/50 text-xs">
            <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                onClick={() => expandable && setExpanded(!expanded)}
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
                        className="shrink-0 text-green-600 dark:text-green-400"
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
                        className="shrink-0 animate-spin text-muted-foreground"
                    >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                )}
                <span className="font-medium text-muted-foreground">{toolLabel(toolName)}</span>
                {isSubagent && stepCount > 0 && (
                    <span className="text-muted-foreground/70">
                        · {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                    </span>
                )}
                {expandable && (
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
            {expanded && expandable && (
                <div className="max-h-64 overflow-auto border-t px-3 py-2">
                    {isSubagent && steps ? (
                        <SubagentStepList steps={steps} isParallel={toolName === 'parallelAnalysis'} />
                    ) : (
                        output && (
                            <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                                {JSON.stringify(output, null, 2).slice(0, 2000)}
                            </pre>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

function ToolCallDisplay({ parts }: { parts: UIMessage['parts'] }) {
    const toolParts = parts.filter((p) => p.type.startsWith('tool-'));
    if (toolParts.length === 0) return null;

    const stepsByCallId = new Map<string, SubagentStepEvent[]>();
    for (const part of parts) {
        if (part.type !== 'data-subagentStep') continue;
        const data = (part as unknown as SubagentStepPart).data;
        if (!data?.toolCallId) continue;
        const arr = stepsByCallId.get(data.toolCallId) ?? [];
        arr.push(data);
        stepsByCallId.set(data.toolCallId, arr);
    }

    return (
        <div className="space-y-1.5">
            {toolParts.map((part, i) => {
                const toolPart = part as ToolPart;
                const steps = toolPart.toolCallId ? stepsByCallId.get(toolPart.toolCallId) : undefined;
                return <ToolCallItem key={i} part={toolPart} steps={steps} />;
            })}
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

/** Layout wrappers that should not be used as a panel title — we want the content type instead */
const LAYOUT_WRAPPER_TYPES = new Set(['Grid', 'GridItem']);

/**
 * Walk a spec and all its elements, returning the first node that matches a predicate.
 * Handles both resolved tree specs (nested children) and flat element-map specs.
 */
function specTreeFind(spec: SpecNode | null | undefined, predicate: (node: SpecNode) => boolean): SpecNode | undefined {
    if (!spec) return undefined;

    // Check the root node itself
    if (predicate(spec)) return spec;

    // Flat element map (raw JSON Render spec shape: { elements: { id: { type, props, children } } })
    if (spec.elements && typeof spec.elements === 'object') {
        for (const el of Object.values(spec.elements)) {
            if (el && predicate(el)) return el;
        }
        return undefined;
    }

    // Resolved tree with nested children
    if (Array.isArray(spec.children)) {
        for (const child of spec.children) {
            if (typeof child !== 'object' || child === null) continue;
            const found = specTreeFind(child as SpecNode, predicate);
            if (found) return found;
        }
    }

    return undefined;
}

function specTreeHas(spec: SpecNode | null | undefined, predicate: (node: SpecNode) => boolean): boolean {
    return specTreeFind(spec, predicate) !== undefined;
}

function formatTypeName(type: string): string {
    return type.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * Determine whether a spec should render inline or in the side panel.
 *
 * Walks the entire spec tree — if ANY node is a panel component or has
 * `layout: "panel"`, the whole spec goes to the panel. This handles
 * cases where the LLM wraps a TokenList inside Grid > GridItem.
 */
function shouldRenderInline(spec: SpecNode | null | undefined): boolean {
    if (!spec) return false;

    // If any node in the tree is a known-large component → panel
    if (specTreeHas(spec, (n) => (n.type ? DEFAULT_PANEL_COMPONENTS.has(n.type) : false))) return false;

    // If any node has layout: "panel" → panel
    if (specTreeHas(spec, (n) => n.props?.layout === 'panel')) return false;

    // If the root explicitly says inline → inline
    if (spec.props?.layout === 'inline') return true;

    // Default: inline
    return true;
}

export function MessageRenderer({ message, isStreaming, onSuggestionClick }: MessageRendererProps) {
    const { spec, hasSpec } = useJsonRenderMessage(message.parts);
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
            const state = (p as ToolPart).state;
            return state === 'output-available' || state === 'result';
        });
    // Show pondering when: streaming with no text/spec, AND either no tools yet or all tools finished (model is thinking)
    const showPondering = isStreaming && !textContent && !hasSpec && (toolParts.length === 0 || allToolsDone);

    // Derive a title from the spec for the panel header. If the root is a layout
    // wrapper (Grid/GridItem) or has no type, walk the tree for the first
    // user-meaningful component name.
    const titleNode =
        hasSpec && spec ? specTreeFind(spec, (n) => !!n.type && !LAYOUT_WRAPPER_TYPES.has(n.type)) : undefined;
    const specTitle = titleNode?.type ? formatTypeName(titleNode.type) : 'Result';

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

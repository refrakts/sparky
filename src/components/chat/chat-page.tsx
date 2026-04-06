'use client';

import { type UIMessage, useChat } from '@ai-sdk/react';
import { SPEC_DATA_PART, type SpecDataPart } from '@json-render/core';
import { X } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import { AiChat, AiChatBody, AiChatFooter } from '@/components/elements/ai-chat';
import { AiChatInput } from '@/components/elements/ai-chat-input';
import { AiMessageBubble } from '@/components/elements/ai-message-bubble';
import { AiMessages } from '@/components/elements/ai-messages';
import { AiSuggestedActions } from '@/components/elements/ai-suggested-actions';
import { Button } from '@/components/ui/button';
import { TextAnimate } from '@/components/ui/text-animate';
import { detectFastPath, type FastPathMatch } from '@/lib/fast-path';
import { useRenderedSummary } from '@/lib/rendered-context';
import { cn } from '@/lib/utils';
import { ChatPanelProvider, useChatPanel } from './chat-panel';
import { FastPathResult } from './fast-path-result';
import { MessageRenderer } from './message-renderer';

type AppDataParts = { [SPEC_DATA_PART]: SpecDataPart };
type AppMessage = UIMessage<unknown, AppDataParts>;

interface FastPathEntry {
    id: string;
    query: string;
    match: NonNullable<FastPathMatch>;
}

const SUGGESTIONS = [
    { label: 'Flashnet pools', prompt: 'Show me the Flashnet AMM pools' },
    { label: 'Latest transactions', prompt: 'What are the latest transactions?' },
    { label: 'Top USDB holders', prompt: 'Who holds the most USDB?' },
    { label: 'All tokens', prompt: 'Show me all tokens on the network' },
];

export function ChatPage() {
    return (
        <ChatPanelProvider>
            <ChatPageInner />
        </ChatPanelProvider>
    );
}

function ChatPageInner() {
    const [sessionId] = useState(() => crypto.randomUUID());
    const {
        messages,
        sendMessage: rawSendMessage,
        status,
        stop,
    } = useChat<AppMessage>({
        dataPartSchemas: {
            [SPEC_DATA_PART]: { schema: z.any() },
        } as never,
    });

    const sendMessage: typeof rawSendMessage = useCallback(
        (message, options) =>
            rawSendMessage(message, {
                ...options,
                body: { sessionId, ...(options?.body as Record<string, unknown>) },
            }),
        [rawSendMessage, sessionId],
    );

    const [fastPathResults, setFastPathResults] = useState<FastPathEntry[]>([]);
    const renderedSummary = useRenderedSummary();
    const isStreaming = status === 'streaming' || status === 'submitted';
    const hasConversation = messages.length > 0 || fastPathResults.length > 0;

    const { panelOpen, panelContent, closePanel } = useChatPanel();

    // ─── Draggable panel resize ──────────────────────────────────────
    const [panelFlex, setPanelFlex] = useState(2); // ratio: chat=1, panel=panelFlex
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const onDragStart = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        setIsDragging(true);
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const chatFraction = Math.max(0.15, Math.min(0.85, x / rect.width));
            setPanelFlex((1 - chatFraction) / chatFraction);
        };

        const onUp = () => {
            setIsDragging(false);
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }, []);

    const submit = useCallback(
        (text: string) => {
            if (!text.trim() || isStreaming) return;

            const match = detectFastPath(text);
            if (match) {
                setFastPathResults((prev) => [...prev, { id: crypto.randomUUID(), query: text, match }]);
                return;
            }

            const rawHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
            const viewportHeight = Math.max(rawHeight - 112, 0);
            const approxVisibleRows = viewportHeight > 0 ? Math.floor(viewportHeight / 40) : 15;

            sendMessage(
                { text },
                {
                    body: {
                        clientContext: {
                            viewport: { height: viewportHeight, visibleRows: approxVisibleRows },
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            onScreen: renderedSummary || undefined,
                        },
                    },
                },
            );
        },
        [isStreaming, renderedSummary, sendMessage],
    );

    const mappedStatus =
        status === 'submitted'
            ? 'submitted'
            : status === 'streaming'
              ? 'streaming'
              : status === 'error'
                ? 'error'
                : 'ready';

    const inputTransition = { type: 'spring' as const, stiffness: 200, damping: 30 };

    // ─── Empty state ────────────────────────────────────────────────
    if (!hasConversation) {
        return (
            <LayoutGroup>
                <AiChat status={mappedStatus} className="min-h-0 flex-1">
                    <AiChatBody className="flex items-center justify-center">
                        <div className="w-full max-w-2xl space-y-6 px-6">
                            <TextAnimate
                                text="What can I help you explore?"
                                type="calmInUp"
                                className="!mt-0 !px-0 !py-0 !pb-0 !text-2xl !font-semibold !text-foreground md:!text-3xl"
                            />
                            <motion.div layoutId="chat-input" layout transition={inputTransition}>
                                <AiChatInput
                                    onSubmit={submit}
                                    placeholder="Ask about addresses, transactions, or tokens..."
                                    disabled={isStreaming}
                                    loading={isStreaming}
                                />
                            </motion.div>
                            <AiSuggestedActions suggestions={SUGGESTIONS} onSelect={submit} />
                        </div>
                    </AiChatBody>
                </AiChat>
            </LayoutGroup>
        );
    }

    // ─── Conversation state ─────────────────────────────────────────
    return (
        <LayoutGroup>
            <div ref={containerRef} className="flex min-h-0 flex-1">
                {/* Chat column */}
                <div
                    className={cn('flex min-h-0 flex-col', !isDragging && 'transition-[flex] duration-300 ease-out')}
                    style={{ flex: '1 1 0%' }}
                >
                    <AiChat status={mappedStatus} className="min-h-0 flex-1">
                        <AiChatBody>
                            <AiMessages autoScroll>
                                {/* Fast path results */}
                                {fastPathResults.map((fp) => (
                                    <div key={fp.id} className="space-y-3">
                                        <div className={cn('flex justify-end', panelOpen ? '' : 'mx-auto max-w-3xl')}>
                                            <AiMessageBubble role="user" content={fp.query} />
                                        </div>
                                        <div className="w-full">
                                            <FastPathResult match={fp.match} />
                                        </div>
                                    </div>
                                ))}

                                {/* Chat messages */}
                                {messages.map((message) => (
                                    <div key={message.id}>
                                        {message.role === 'user' ? (
                                            <div
                                                className={cn('flex justify-end', panelOpen ? '' : 'mx-auto max-w-3xl')}
                                            >
                                                <AiMessageBubble
                                                    role="user"
                                                    content={message.parts
                                                        .filter((p) => p.type === 'text')
                                                        .map((p) => (p as { type: 'text'; text: string }).text)
                                                        .join('')}
                                                />
                                            </div>
                                        ) : (
                                            <div className={cn('w-full', panelOpen ? '' : 'mx-auto max-w-3xl')}>
                                                <MessageRenderer
                                                    message={message}
                                                    isStreaming={isStreaming && message.id === messages.at(-1)?.id}
                                                    onSuggestionClick={
                                                        !isStreaming && message.id === messages.at(-1)?.id
                                                            ? submit
                                                            : undefined
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </AiMessages>
                        </AiChatBody>

                        <AiChatFooter className="px-4 py-3">
                            <motion.div
                                layoutId="chat-input"
                                layout
                                transition={inputTransition}
                                className={cn('mx-auto', panelOpen ? '' : 'max-w-3xl')}
                            >
                                <AiChatInput
                                    onSubmit={submit}
                                    onStop={isStreaming ? () => stop() : undefined}
                                    placeholder={isStreaming ? 'Generating...' : 'Ask a follow-up...'}
                                    disabled={isStreaming}
                                    loading={isStreaming}
                                />
                            </motion.div>
                        </AiChatFooter>
                    </AiChat>
                </div>

                {/* Drag handle + Content panel */}
                <AnimatePresence>
                    {panelOpen && (
                        <motion.div
                            initial={{ opacity: 0, flex: 0 }}
                            animate={{ opacity: 1, flex: panelFlex }}
                            exit={{ opacity: 0, flex: 0 }}
                            transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
                            className={cn('flex min-h-0 min-w-0', isDragging && 'select-none')}
                        >
                            {/* Resize handle */}
                            <div
                                className="group relative z-30 flex h-full w-3 shrink-0 cursor-col-resize items-center justify-center"
                                onPointerDown={onDragStart}
                            >
                                {/* Top line segment */}
                                <div className="absolute inset-x-0 top-0 bottom-[calc(50%+12px)] flex justify-center">
                                    <div className="w-px bg-border transition-colors group-hover:bg-foreground/30" />
                                </div>
                                {/* Pill */}
                                <div className="relative z-10 h-6 w-1.5 rounded-full border border-border bg-background shadow-sm transition-colors group-hover:border-foreground/40 group-hover:bg-foreground/10" />
                                {/* Bottom line segment */}
                                <div className="absolute inset-x-0 top-[calc(50%+12px)] bottom-0 flex justify-center">
                                    <div className="w-px bg-border transition-colors group-hover:bg-foreground/30" />
                                </div>
                            </div>

                            {/* Panel content */}
                            <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                                {/* Floating close button */}
                                <div className="absolute right-3 top-3 z-20">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={closePanel}
                                        className="size-7 cursor-pointer rounded-full border-border/50 bg-background/60 backdrop-blur-sm shadow-sm hover:bg-background/90"
                                    >
                                        <X className="size-3.5" />
                                        <span className="sr-only">Close panel</span>
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 pt-4">{panelContent}</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </LayoutGroup>
    );
}

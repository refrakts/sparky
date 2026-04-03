'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type MessageRole = 'user' | 'assistant';

interface AiMessageBubbleProps {
    role: MessageRole;
    content?: string;
    timestamp?: Date;
    isStreaming?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export function AiMessageBubble({
    role,
    content,
    timestamp,
    isStreaming = false,
    className,
    children,
}: AiMessageBubbleProps) {
    const [copied, setCopied] = React.useState(false);

    const isUser = role === 'user';

    const handleCopy = React.useCallback(async () => {
        if (content) await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [content]);

    return (
        <div
            data-slot="ai-message-bubble"
            role="article"
            aria-label={isUser ? 'Your message' : 'AI response'}
            className={cn('group flex', isUser && 'justify-end', className)}
        >
            <div
                className={cn(
                    'relative w-fit max-w-[50vw]',
                    isUser
                        ? 'rounded-xl rounded-br-sm bg-foreground px-3 py-1.5 text-background'
                        : 'px-3 py-2 text-foreground',
                )}
            >
                <div aria-live={isStreaming ? 'polite' : undefined}>
                    {children ? (
                        <div className="prose prose-xs dark:prose-invert max-w-none text-[13px] leading-relaxed [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-[13px] [&_h4]:text-[13px] [&_p]:text-[13px] [&_li]:text-[13px] [&_code]:text-xs [&_pre]:text-xs">
                            {children}
                        </div>
                    ) : (
                        <p className="m-0 whitespace-pre-wrap text-[13px] leading-normal">{content}</p>
                    )}
                    {isStreaming && <span className="ml-1 inline-block h-3.5 w-[2px] animate-pulse bg-current" />}
                </div>

                {timestamp && (
                    <time className="mt-2 block text-[10px] uppercase tracking-wider opacity-60">
                        {timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </time>
                )}

                {!isUser && !isStreaming && (
                    <button
                        type="button"
                        className="absolute -right-8 top-0.5 flex size-6 items-center justify-center rounded-md border bg-background opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                        <span className="sr-only">Copy message</span>
                    </button>
                )}
            </div>
        </div>
    );
}

export type { AiMessageBubbleProps, MessageRole };

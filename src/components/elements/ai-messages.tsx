'use client';

import { ArrowDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface AiMessagesProps {
    children?: React.ReactNode;
    className?: string;
    autoScroll?: boolean;
}

function AiMessages({ children, className, autoScroll = true }: AiMessagesProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const endRef = React.useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = React.useState(true);

    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        endRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, []);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const threshold = 100;
            setIsAtBottom(scrollHeight - scrollTop - clientHeight < threshold);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    React.useEffect(() => {
        if (autoScroll && isAtBottom) {
            scrollToBottom('instant');
        }
    });

    return (
        <div data-slot="ai-messages" className={cn('relative h-full', className)}>
            <div ref={containerRef} className="absolute inset-0 touch-pan-y overflow-y-auto">
                <div className="mx-auto flex min-w-0 flex-col gap-6 px-4 pt-3 pb-8">
                    {children}
                    <div ref={endRef} className="min-h-6 shrink-0" />
                </div>
            </div>

            <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                aria-label="Scroll to bottom"
                className={cn(
                    'absolute bottom-4 left-1/2 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background shadow-sm transition-all hover:bg-muted',
                    isAtBottom ? 'pointer-events-none scale-0 opacity-0' : 'pointer-events-auto scale-100 opacity-100',
                )}
            >
                <ArrowDown className="size-4" />
            </button>
        </div>
    );
}

export type { AiMessagesProps };
export { AiMessages };

'use client';

import { JSONUIProvider } from '@json-render/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DataCacheProvider } from '@/lib/data-cache';
import { registry } from '@/lib/registry';
import { RenderedContextProvider } from '@/lib/rendered-context';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <NuqsAdapter>
                <TooltipProvider>
                    <DataCacheProvider>
                        <RenderedContextProvider>
                            <JSONUIProvider registry={registry}>
                                <div className="flex h-dvh flex-col">{children}</div>
                            </JSONUIProvider>
                        </RenderedContextProvider>
                    </DataCacheProvider>
                </TooltipProvider>
            </NuqsAdapter>
        </QueryClientProvider>
    );
}

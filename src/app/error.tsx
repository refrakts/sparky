'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        posthog.captureException(error);
    }, [error]);

    return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <button
                type="button"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
                onClick={reset}
            >
                Try again
            </button>
        </div>
    );
}

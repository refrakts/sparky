/**
 * Race a promise against a timeout. On timeout, rejects with a labeled
 * `Error`. `onLateResolve` runs if the underlying promise eventually settles
 * fulfilled after the timeout fired — so callers can close orphan
 * resources (e.g. an MCP client that connected too late).
 *
 * The timer is cleared whenever the wrapped promise wins, so long-running
 * callers don't accumulate pending timers that would keep the Node /
 * serverless event loop alive past the actual work.
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
    onLateResolve?: (value: T) => void,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
        promise.then(
            (value) => {
                if (settled) {
                    if (onLateResolve) {
                        try {
                            onLateResolve(value);
                        } catch (error) {
                            console.error(`[withTimeout] late-resolve cleanup for ${label} threw:`, error);
                        }
                    }
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

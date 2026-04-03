export function register() {
    // No-op for initialization
}

export const onRequestError = async (
    err: Error,
    request: { headers: { cookie?: string | string[] } },
    _context: unknown,
) => {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { default: PostHogClient } = await import('./lib/posthog');
        const posthog = PostHogClient();

        let distinctId: string | undefined;

        if (request.headers.cookie) {
            const cookieString = Array.isArray(request.headers.cookie)
                ? request.headers.cookie.join('; ')
                : request.headers.cookie;

            const postHogCookieMatch = cookieString.match(/ph_.*?_posthog=([^;]+)/);

            if (postHogCookieMatch?.[1]) {
                try {
                    const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
                    const postHogData = JSON.parse(decodedCookie);
                    distinctId = postHogData.distinct_id;
                } catch (e) {
                    console.error('Error parsing PostHog cookie:', e);
                }
            }
        }

        await posthog.captureException(err, distinctId);
        await posthog.shutdown();
    }
};

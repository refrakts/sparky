import posthog from 'posthog-js';
import { env } from '@/env';

posthog.init(env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    api_host: '/ph',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    // Forward the PostHog session id to our backend as X-POSTHOG-SESSION-ID,
    // so server-emitted AI events can be linked to the user's web session.
    __add_tracing_headers: typeof window !== 'undefined' ? [window.location.host] : [],
});

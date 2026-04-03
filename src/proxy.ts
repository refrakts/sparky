import { type NextRequest, NextResponse } from 'next/server';

const PH_PREFIX = '/ph';

function handlePostHogProxy(request: NextRequest): NextResponse {
    const url = request.nextUrl.clone();
    const hostname = url.pathname.startsWith(`${PH_PREFIX}/static/`) ? 'us-assets.i.posthog.com' : 'us.i.posthog.com';

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('host', hostname);

    const clientIp =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        (request as NextRequest & { ip?: string }).ip;
    if (clientIp) {
        requestHeaders.set('x-forwarded-for', clientIp);
    }

    url.protocol = 'https';
    url.hostname = hostname;
    url.port = '443';
    url.pathname = url.pathname.replace(new RegExp(`^${PH_PREFIX}`), '');

    return NextResponse.rewrite(url, {
        headers: requestHeaders,
    });
}

export default async function proxy(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith(PH_PREFIX)) {
        return handlePostHogProxy(request);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

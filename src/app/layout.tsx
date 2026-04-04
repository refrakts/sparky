import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from './providers';
import './globals.css';

const gelasio = localFont({
    src: [
        { path: '../fonts/Gelasio-Regular.woff2', weight: '400', style: 'normal' },
        { path: '../fonts/Gelasio-Medium.woff2', weight: '500', style: 'normal' },
        { path: '../fonts/Gelasio-SemiBold.woff2', weight: '600', style: 'normal' },
        { path: '../fonts/Gelasio-Bold.woff2', weight: '700', style: 'normal' },
    ],
    variable: '--font-gelasio',
    display: 'swap',
});

export const metadata: Metadata = {
    metadataBase: new URL('https://sparky-eta.vercel.app'),
    title: {
        template: '%s | Sparky',
        default: 'Sparky',
    },
    description: 'AI-powered Spark blockchain explorer',
    openGraph: {
        title: 'Sparky',
        description: 'AI-powered Spark blockchain explorer',
        siteName: 'Sparky',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary',
        title: 'Sparky',
        description: 'AI-powered Spark blockchain explorer',
    },
    icons: {
        icon: '/favicon.ico',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${GeistSans.variable} ${GeistMono.variable} ${gelasio.variable} h-full antialiased`}
        >
            <body className="h-full font-sans">
                <Providers>{children}</Providers>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ChatPage } from '@/components/chat/chat-page';

const Watercolor = dynamic(() => import('@/components/ui/watercolor').then((m) => m.Watercolor), { ssr: false });

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduced(mql.matches);
        update();
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
    }, []);
    return reduced;
}

export default function HomePage() {
    const reduced = usePrefersReducedMotion();
    return (
        <div className="relative isolate flex h-full flex-col">
            <Watercolor
                className="-z-10 pointer-events-none absolute inset-0"
                color1="#f5ecd9"
                color2="#d6e4f0"
                speed={reduced ? 0 : 0.35}
                scale={0.85}
                saturation={1}
                brightness={0}
                opacity={0.55}
                cursorInteraction
                cursorIntensity={0.6}
            />
            <ChatPage />
        </div>
    );
}

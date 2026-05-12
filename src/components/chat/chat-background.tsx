'use client';

import { useEffect, useState } from 'react';
import { Watercolor } from '@/components/ui/watercolor';

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

export function ChatBackground() {
    const reduced = usePrefersReducedMotion();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <Watercolor
            className="-z-10 pointer-events-none absolute inset-0"
            color1="#0a0a0a"
            color2="#e0e0e0"
            speed={reduced ? 0 : 0.3}
            scale={0.6}
            octaves={6}
            persistence={0.6}
            lacunarity={2.4}
            driftSpeed={0.04}
            warpSpeed={0.08}
            colorGain={1}
            saturation={0}
            brightness={0.15}
            opacity={0.35}
            cursorInteraction={!reduced}
            cursorIntensity={0.3}
            frameloop={reduced ? 'demand' : 'always'}
        />
    );
}

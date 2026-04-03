'use client';

import type { Spec } from '@json-render/core';
import { Renderer } from '@json-render/react';
import { registry } from '@/lib/registry';

interface DashboardRendererProps {
    spec: Spec;
}

export function DashboardRenderer({ spec }: DashboardRendererProps) {
    return (
        <div className="w-full">
            <Renderer spec={spec} registry={registry} />
        </div>
    );
}

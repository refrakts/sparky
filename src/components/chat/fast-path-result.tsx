'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AddressSummary } from '@/components/explorer/address-summary';
import { TokenDetail } from '@/components/explorer/token-detail';
import { TransactionDetail } from '@/components/explorer/transaction-detail';
import type { FastPathMatch } from '@/lib/fast-path';
import { useChatPanel } from './chat-panel';

interface FastPathResultProps {
    match: NonNullable<FastPathMatch>;
}

function getTitle(match: NonNullable<FastPathMatch>): string {
    switch (match.type) {
        case 'address':
            return 'Address Summary';
        case 'transaction':
            return 'Transaction Detail';
        case 'token':
            return 'Token Detail';
    }
}

function getComponent(match: NonNullable<FastPathMatch>) {
    switch (match.type) {
        case 'address':
            return <AddressSummary address={match.value} />;
        case 'transaction':
            return <TransactionDetail txid={match.value} />;
        case 'token':
            return <TokenDetail identifier={match.value} />;
    }
}

export function FastPathResult({ match }: FastPathResultProps) {
    const { openPanel } = useChatPanel();
    const autoOpenedRef = useRef(false);

    const title = getTitle(match);
    const component = getComponent(match);

    useEffect(() => {
        if (!autoOpenedRef.current) {
            autoOpenedRef.current = true;
            openPanel(component, title);
        }
    }, [openPanel, component, title]);

    const handleClick = () => {
        openPanel(component, title);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="flex w-full items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60"
        >
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-medium">{title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">View</span>
        </button>
    );
}

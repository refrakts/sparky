'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    directionStyle,
    formatDate,
    formatNumber,
    formatPercent,
    formatSats,
    formatTimeago,
    formatTokenAmount,
    formatUsd,
    statusColor,
    truncateAddress,
    truncateTxid,
    txTypeColor,
    txTypeLabel,
} from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ─── Copy Button Helper ─────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
    return (
        <button
            type="button"
            className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground"
            onClick={() => navigator.clipboard.writeText(value)}
            aria-label="Copy to clipboard"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
        </button>
    );
}

// ─── Address Cell ───────────────────────────────────────────────────

export function AddressCell({ value }: { value: string }) {
    return (
        <span className="inline-flex items-center font-mono text-sm">
            <Tooltip>
                <TooltipTrigger className="cursor-default">{truncateAddress(value)}</TooltipTrigger>
                <TooltipContent>{value}</TooltipContent>
            </Tooltip>
            <CopyButton value={value} />
        </span>
    );
}

// ─── Txid Cell ──────────────────────────────────────────────────────

export function TxidCell({ value }: { value: string }) {
    return (
        <span className="inline-flex items-center font-mono text-sm">
            <Tooltip>
                <TooltipTrigger className="cursor-default">{truncateTxid(value)}</TooltipTrigger>
                <TooltipContent>{value}</TooltipContent>
            </Tooltip>
            <CopyButton value={value} />
        </span>
    );
}

// ─── Sats Cell ──────────────────────────────────────────────────────

export function SatsCell({ value }: { value: number }) {
    if (value == null || Number.isNaN(value)) return <span className="text-muted-foreground">—</span>;
    return <span className="tabular-nums">{formatSats(value)}</span>;
}

// ─── Token Amount Cell ──────────────────────────────────────────────

export function TokenAmountCell({ value, decimals, ticker }: { value: string; decimals: number; ticker?: string }) {
    return <span className="tabular-nums">{formatTokenAmount(value, decimals, ticker)}</span>;
}

// ─── USD Cell ───────────────────────────────────────────────────────

export function UsdCell({ value }: { value: number }) {
    if (value == null || Number.isNaN(value)) return <span className="text-muted-foreground">—</span>;
    return <span className="tabular-nums">{formatUsd(value)}</span>;
}

// ─── Percent Cell ───────────────────────────────────────────────────

export function PercentCell({ value }: { value: number }) {
    return <span className="tabular-nums">{formatPercent(value)}</span>;
}

// ─── Timeago Cell ───────────────────────────────────────────────────

export function TimeagoCell({ value }: { value: string }) {
    return (
        <Tooltip>
            <TooltipTrigger className="cursor-default text-muted-foreground">{formatTimeago(value)}</TooltipTrigger>
            <TooltipContent>{formatDate(value)}</TooltipContent>
        </Tooltip>
    );
}

// ─── Date Cell ──────────────────────────────────────────────────────

export function DateCell({ value }: { value: string }) {
    return <span>{formatDate(value)}</span>;
}

// ─── Badge Cell ─────────────────────────────────────────────────────

export function BadgeCell({ value, colorMap }: { value: string; colorMap?: Record<string, string> }) {
    return (
        <Badge variant="secondary" className={cn(colorMap?.[value])}>
            {value}
        </Badge>
    );
}

// ─── Transaction Type Badge ─────────────────────────────────────────

export function TxTypeBadge({ value }: { value: string }) {
    return (
        <Badge variant="secondary" className={cn(txTypeColor(value))}>
            {txTypeLabel(value)}
        </Badge>
    );
}

// ─── Status Badge ───────────────────────────────────────────────────

export function StatusBadge({ value }: { value: string }) {
    return (
        <Badge variant="secondary" className={cn(statusColor(value))}>
            {value}
        </Badge>
    );
}

// ─── Direction Badge ────────────────────────────────────────────────

export function DirectionBadge({ value }: { value: string }) {
    const style = directionStyle(value);
    return (
        <Badge variant="secondary" className={cn(style.color)}>
            <span className="mr-0.5">{style.arrow}</span>
            {style.label}
        </Badge>
    );
}

// ─── Icon URL Cell ──────────────────────────────────────────────────

export function IconUrlCell({ value }: { value: string }) {
    if (!value) {
        return (
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                ?
            </div>
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={value}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
            onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
            }}
        />
    );
}

// ─── Number Cell ────────────────────────────────────────────────────

export function NumberCell({ value }: { value: number }) {
    return <span className="tabular-nums">{formatNumber(value)}</span>;
}

// ─── Compact Number Cell ────────────────────────────────────────────

export function CompactNumberCell({ value }: { value: string | number }) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return <span className="text-muted-foreground">—</span>;
    const formatted =
        num >= 1_000_000
            ? `${(num / 1_000_000).toFixed(2)}M`
            : num >= 1_000
              ? `${(num / 1_000).toFixed(2)}K`
              : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return <span className="tabular-nums">{formatted}</span>;
}

// ─── Pool Price Cell ────────────────────────────────────────────────

export function PoolPriceCell({ value }: { value: string | number }) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return <span className="text-muted-foreground">—</span>;
    const formatted =
        num === 0
            ? '0'
            : num >= 1
              ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : num >= 0.0001
                ? num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
                : num.toExponential(2);
    return <span className="tabular-nums">{formatted}</span>;
}

// ─── Change Percent Cell ────────────────────────────────────────────

export function ChangePercentCell({ value }: { value: string | number }) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return <span className="text-muted-foreground">—</span>;
    const color =
        num > 0
            ? 'text-green-600 dark:text-green-400'
            : num < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground';
    return (
        <span className={cn('tabular-nums', color)}>
            {num > 0 ? '+' : ''}
            {num.toFixed(2)}%
        </span>
    );
}

// ─── Curve Type Cell ────────────────────────────────────────────────

const CURVE_LABELS: Record<string, string> = {
    CONSTANT_PRODUCT: 'Constant Product',
    SINGLE_SIDED: 'Single Sided',
};

export function CurveTypeCell({ value }: { value: string }) {
    return <Badge variant="secondary">{CURVE_LABELS[value] ?? value}</Badge>;
}

// ─── Text Cell ──────────────────────────────────────────────────────

export function TextCell({ value }: { value: string }) {
    return <span>{value}</span>;
}

// ─── Renderer Map ───────────────────────────────────────────────────

export type CellRendererType =
    | 'text'
    | 'number'
    | 'compact-number'
    | 'pool-price'
    | 'change-percent'
    | 'curve-type'
    | 'address'
    | 'txid'
    | 'sats'
    | 'token-amount'
    | 'usd'
    | 'percent'
    | 'date'
    | 'timeago'
    | 'badge'
    | 'direction-badge'
    | 'tx-type-badge'
    | 'status-badge'
    | 'icon-url';

/**
 * Render a cell value based on its type.
 * For token-amount, pass decimals and ticker via the options parameter.
 */
export function renderCell(
    type: CellRendererType,
    value: unknown,
    options?: { decimals?: number; ticker?: string; colorMap?: Record<string, string> },
): React.ReactNode {
    switch (type) {
        case 'address':
            return <AddressCell value={String(value)} />;
        case 'txid':
            return <TxidCell value={String(value)} />;
        case 'sats':
            return <SatsCell value={Number(value)} />;
        case 'token-amount':
            return <TokenAmountCell value={String(value)} decimals={options?.decimals ?? 8} ticker={options?.ticker} />;
        case 'usd':
            return <UsdCell value={Number(value)} />;
        case 'percent':
            return <PercentCell value={Number(value)} />;
        case 'timeago':
            return <TimeagoCell value={String(value)} />;
        case 'date':
            return <DateCell value={String(value)} />;
        case 'tx-type-badge':
            return <TxTypeBadge value={String(value)} />;
        case 'status-badge':
            return <StatusBadge value={String(value)} />;
        case 'direction-badge':
            return <DirectionBadge value={String(value)} />;
        case 'badge':
            return <BadgeCell value={String(value)} colorMap={options?.colorMap} />;
        case 'icon-url':
            return <IconUrlCell value={String(value)} />;
        case 'number':
            return <NumberCell value={Number(value)} />;
        case 'compact-number':
            return <CompactNumberCell value={value as string | number} />;
        case 'pool-price':
            return <PoolPriceCell value={value as string | number} />;
        case 'change-percent':
            return <ChangePercentCell value={value as string | number} />;
        case 'curve-type':
            return <CurveTypeCell value={String(value)} />;
        default:
            return <TextCell value={String(value ?? '')} />;
    }
}

import { format, formatDistanceToNow } from 'date-fns';
import type { Direction, TransactionStatus, TransactionType } from './types';

// ─── Address / Txid Truncation ───────────────────────────────────────

export function truncateAddress(addr: string, startLen = 8, endLen = 6): string {
    if (addr.length <= startLen + endLen + 3) return addr;
    return `${addr.slice(0, startLen)}...${addr.slice(-endLen)}`;
}

export function truncateTxid(txid: string, startLen = 8, endLen = 6): string {
    if (txid.length <= startLen + endLen + 3) return txid;
    return `${txid.slice(0, startLen)}...${txid.slice(-endLen)}`;
}

// ─── Number Formatting ──────────────────────────────────────────────

export function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

export function formatSats(sats: number): string {
    return `${formatNumber(sats)} sats`;
}

export function formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatPercent(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value / 100);
}

export function formatTokenAmount(amount: string, decimals: number, ticker?: string): string {
    const num = Number(amount) / 10 ** decimals;
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: Math.min(decimals, 8),
    }).format(num);
    return ticker ? `${formatted} ${ticker}` : formatted;
}

// ─── Date Formatting ────────────────────────────────────────────────

/** Normalize non-standard timezone offsets like "+00:00:00" to "+00:00" */
function safeParseDate(dateStr: string): Date {
    const normalized = dateStr.replace(/([+-]\d{2}:\d{2}):\d{2}$/, '$1');
    return new Date(normalized);
}

export function formatTimeago(dateStr: string): string {
    return formatDistanceToNow(safeParseDate(dateStr), { addSuffix: true });
}

export function formatDate(dateStr: string): string {
    return format(safeParseDate(dateStr), 'MMM d, yyyy HH:mm:ss');
}

// ─── Compact / Latency Formatting ───────────────────────────────────

export function formatLatency(ms: number): string {
    if (ms >= 1000) {
        return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000)}s`;
    }
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(ms)}ms`;
}

export function formatMilliseconds(value: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

export function formatCompactNumber(value: number): string {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
}

// ─── Transaction Type Labels & Colors ───────────────────────────────

const TX_TYPE_LABELS: Record<TransactionType, string> = {
    bitcoin_deposit: 'BTC Deposit',
    bitcoin_withdrawal: 'BTC Withdrawal',
    spark_transfer: 'Transfer',
    lightning_payment: 'Lightning',
    token_mint: 'Token Mint',
    token_transfer: 'Token Transfer',
    token_burn: 'Token Burn',
    token_multi_transfer: 'Multi Transfer',
    unknown_token_op: 'Token Op',
    unknown_transfer: 'Unknown',
};

const TX_TYPE_COLORS: Record<TransactionType, string> = {
    spark_transfer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    lightning_payment: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    bitcoin_deposit: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    bitcoin_withdrawal: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    token_mint: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    token_transfer: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    token_burn: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    token_multi_transfer: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    unknown_token_op: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    unknown_transfer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

export function txTypeLabel(type: string): string {
    return TX_TYPE_LABELS[type as TransactionType] ?? type;
}

export function txTypeColor(type: string): string {
    return TX_TYPE_COLORS[type as TransactionType] ?? TX_TYPE_COLORS.unknown_transfer;
}

// ─── Status Colors ──────────────────────────────────────────────────

const STATUS_COLORS: Record<TransactionStatus, string> = {
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

export function statusColor(status: string): string {
    return STATUS_COLORS[status as TransactionStatus] ?? STATUS_COLORS.expired;
}

const STATUS_BORDER_COLORS: Record<TransactionStatus, string> = {
    confirmed: 'border-l-green-500',
    pending: 'border-l-yellow-500',
    sent: 'border-l-blue-500',
    failed: 'border-l-red-500',
    expired: 'border-l-gray-400',
};

export function statusBorderColor(status: string): string {
    return STATUS_BORDER_COLORS[status as TransactionStatus] ?? STATUS_BORDER_COLORS.expired;
}

// ─── Direction ──────────────────────────────────────────────────────

interface DirectionStyle {
    label: string;
    color: string;
    arrow: '↓' | '↑' | '↔' | '→';
}

const DIRECTION_STYLES: Record<Direction, DirectionStyle> = {
    incoming: { label: 'In', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', arrow: '↓' },
    outgoing: { label: 'Out', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', arrow: '↑' },
    creation: {
        label: 'Create',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        arrow: '→',
    },
    destruction: { label: 'Destroy', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', arrow: '→' },
    transfer: { label: 'Transfer', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', arrow: '↔' },
    deposit: {
        label: 'Deposit',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        arrow: '↓',
    },
    withdrawal: {
        label: 'Withdraw',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        arrow: '↑',
    },
    payment: { label: 'Payment', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', arrow: '→' },
    settlement: {
        label: 'Settle',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        arrow: '→',
    },
    unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300', arrow: '→' },
};

export function directionStyle(direction: string): DirectionStyle {
    return DIRECTION_STYLES[direction as Direction] ?? DIRECTION_STYLES.unknown;
}

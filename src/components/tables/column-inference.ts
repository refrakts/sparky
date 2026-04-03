import type { CellRendererType } from './cell-renderers';

interface FieldFormatter {
    label: string;
    render: CellRendererType;
}

/**
 * Auto-infer column types from field names.
 * Maps known API response field names to display labels and cell renderer types.
 */
const FIELD_FORMATTERS: Record<string, FieldFormatter> = {
    address: { label: 'Address', render: 'address' },
    sparkAddress: { label: 'Address', render: 'address' },
    sender_address: { label: 'Sender', render: 'address' },
    recipient_address: { label: 'Recipient', render: 'address' },
    id: { label: 'Transaction', render: 'txid' },
    txid: { label: 'BTC Txid', render: 'txid' },
    balance: { label: 'Balance', render: 'token-amount' },
    amount: { label: 'Amount', render: 'token-amount' },
    tokenAmount: { label: 'Amount', render: 'token-amount' },
    amountSats: { label: 'Amount (sats)', render: 'sats' },
    valueUsd: { label: 'Value (USD)', render: 'usd' },
    totalValueUsd: { label: 'Total Value', render: 'usd' },
    percentage: { label: '% Supply', render: 'percent' },
    priceUsd: { label: 'Price', render: 'usd' },
    marketCapUsd: { label: 'Market Cap', render: 'usd' },
    volume24hUsd: { label: '24h Volume', render: 'usd' },
    createdAt: { label: 'Time', render: 'timeago' },
    updatedAt: { label: 'Updated', render: 'timeago' },
    type: { label: 'Type', render: 'tx-type-badge' },
    status: { label: 'Status', render: 'status-badge' },
    direction: { label: 'Direction', render: 'direction-badge' },
    ticker: { label: 'Ticker', render: 'text' },
    name: { label: 'Name', render: 'text' },
    holderCount: { label: 'Holders', render: 'number' },
    transactionCount: { label: 'Transactions', render: 'number' },
    tokenCount: { label: 'Tokens', render: 'number' },
    decimals: { label: 'Decimals', render: 'number' },
    iconUrl: { label: 'Icon', render: 'icon-url' },
};

export interface InferredColumn {
    key: string;
    label: string;
    render: CellRendererType;
    sortable: boolean;
}

/**
 * Given a sample data row, infer columns using the FIELD_FORMATTERS map.
 * Unknown fields default to "text" renderer.
 */
export function inferColumns(sampleRow: Record<string, unknown>): InferredColumn[] {
    return Object.keys(sampleRow).map((key) => {
        const formatter = FIELD_FORMATTERS[key];
        if (formatter) {
            return {
                key,
                label: formatter.label,
                render: formatter.render,
                sortable: true,
            };
        }
        return {
            key,
            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
            render: 'text' as CellRendererType,
            sortable: false,
        };
    });
}

/**
 * Get the formatter for a specific field name.
 */
export function getFieldFormatter(fieldName: string): FieldFormatter | undefined {
    return FIELD_FORMATTERS[fieldName];
}

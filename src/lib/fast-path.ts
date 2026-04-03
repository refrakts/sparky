/**
 * Fast path: detect addresses, txids, and token identifiers from user input.
 * When matched, render the appropriate component directly — zero LLM tokens.
 */

export type FastPathMatch =
    | { type: 'address'; value: string }
    | { type: 'transaction'; value: string }
    | { type: 'token'; value: string }
    | null;

// Spark address: sp1... or spark1... (bech32)
const SPARK_ADDRESS_RE = /^(sp1|spark1)[a-z0-9]{20,}$/i;

// Transaction ID: UUID format (with hyphens)
const TX_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Token identifier: 64-char hex
const TOKEN_HEX_RE = /^[0-9a-f]{64}$/i;

// Token address: btk... or btkn... (bech32)
const TOKEN_ADDRESS_RE = /^(btk|btkn)1[a-z0-9]{20,}$/i;

export function detectFastPath(input: string): FastPathMatch {
    const trimmed = input.trim();

    if (SPARK_ADDRESS_RE.test(trimmed)) {
        return { type: 'address', value: trimmed };
    }

    if (TX_UUID_RE.test(trimmed)) {
        return { type: 'transaction', value: trimmed };
    }

    if (TOKEN_HEX_RE.test(trimmed)) {
        return { type: 'token', value: trimmed };
    }

    if (TOKEN_ADDRESS_RE.test(trimmed)) {
        return { type: 'token', value: trimmed };
    }

    return null;
}

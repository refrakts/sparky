// ─── Transaction Types ───────────────────────────────────────────────

export type TransactionType =
    | 'bitcoin_deposit'
    | 'bitcoin_withdrawal'
    | 'spark_transfer'
    | 'lightning_payment'
    | 'token_mint'
    | 'token_transfer'
    | 'token_burn'
    | 'token_multi_transfer'
    | 'unknown_token_op'
    | 'unknown_transfer';

export type TransactionStatus = 'confirmed' | 'pending' | 'sent' | 'failed' | 'expired';

export type Direction =
    | 'incoming'
    | 'outgoing'
    | 'creation'
    | 'destruction'
    | 'transfer'
    | 'deposit'
    | 'withdrawal'
    | 'payment'
    | 'settlement'
    | 'unknown';

export type PartyType = 'spark' | 'lightning' | 'bitcoin' | 'issuer' | 'burn_address' | 'unknown';

// ─── Shared Schemas ──────────────────────────────────────────────────

export interface TokenMetadata {
    tokenIdentifier: string;
    tokenAddress: string;
    name: string;
    ticker: string;
    decimals: number;
    issuerPublicKey: string;
    maxSupply: string | null;
    isFreezable: boolean | null;
    iconUrl?: string;
}

export interface Party {
    type: PartyType;
    identifier: string;
    pubkey?: string;
    tokenMetadata?: TokenMetadata;
}

export interface MultiIoEntry {
    address: string;
    pubkey: string;
    amount: string;
}

export interface MultiIoDetails {
    inputs: MultiIoEntry[];
    outputs: MultiIoEntry[];
    totalInputAmount: string;
    totalOutputAmount: string;
}

export interface BitcoinTxData {
    txid: string;
    fee: number;
    block?: {
        height: number;
        hash: string;
        timestamp: string;
    };
    vin: Array<{ address: string; value: number }>;
    vout: Array<{ address: string; value: number }>;
}

// ─── Transaction (v1 list item — address transactions) ───────────────

export interface AddressTransaction {
    id: string;
    type: TransactionType;
    direction: Direction;
    status: TransactionStatus;
    counterparty?: Party;
    amountSats?: number;
    tokenAmount?: string;
    valueUsd: number;
    createdAt: string;
    updatedAt?: string;
    tokenMetadata?: TokenMetadata;
    multiIoDetails?: MultiIoDetails;
    swapId?: string;
}

// ─── Transaction (v1 latest / detail) ────────────────────────────────

export interface Transaction {
    id: string;
    type: TransactionType;
    status: TransactionStatus;
    from?: Party;
    to?: Party;
    amountSats?: number;
    amount?: string;
    valueUsd?: number;
    createdAt: string;
    updatedAt?: string;
    expiredTime?: string | null;
    tokenMetadata?: TokenMetadata;
    multiIoDetails?: MultiIoDetails;
    bitcoinTxData?: BitcoinTxData;
}

// ─── Pagination ──────────────────────────────────────────────────────

export interface PaginationMeta {
    totalItems: number;
    limit: number;
    offset: number;
}

export interface PaginatedResponse<T> {
    meta: PaginationMeta;
    data: T[];
}

// ─── Address ─────────────────────────────────────────────────────────

export interface AddressBalance {
    btcSoftBalanceSats: number;
    btcHardBalanceSats: number;
    btcValueUsdHard: number;
    btcValueUsdSoft: number;
    totalTokenValueUsd: number;
}

export interface AddressTokenHolding {
    tokenIdentifier: string;
    tokenAddress: string;
    name: string;
    ticker: string;
    decimals: number;
    balance: string;
    valueUsd: number;
    issuerPublicKey: string;
    iconUrl?: string;
    maxSupply: string | null;
    isFreezable: boolean | null;
}

export interface AddressSummaryData {
    sparkAddress: string;
    publicKey: string;
    balance: AddressBalance;
    totalValueUsd: number;
    transactionCount: number;
    tokenCount: number;
    tokens: AddressTokenHolding[] | null;
}

export interface AddressTokensResponse {
    tokens: AddressTokenHolding[];
    tokenCount: number;
    totalTokenValueUsd: number;
}

// ─── Token ───────────────────────────────────────────────────────────

export interface TokenDetail {
    metadata: TokenMetadata & {
        holderCount: number;
        priceUsd: number;
        createdAt: string | null;
        updatedAt: string | null;
    };
    totalSupply: string;
    marketCapUsd: number;
    volume24hUsd: number;
}

export interface TokenHolder {
    address: string;
    pubkey: string;
    balance: string;
    valueUsd: number;
    percentage: number;
}

export interface TokenListItem {
    tokenIdentifier: string;
    tokenAddress: string;
    issuerPublicKey: string;
    name: string;
    ticker: string;
    decimals: number;
    iconUrl: string;
    holderCount: number;
    totalSupply: string;
    maxSupply: string;
    isFreezable: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TokenListResponse {
    tokens: TokenListItem[];
    totalTokens: number;
    nextCursor: string | null;
}

// ─── Stats ───────────────────────────────────────────────────────────

export interface NetworkSummary {
    totalValueLockedSats: number;
    totalValueLockedUsd: number;
    activeAccounts: number;
    transactions24h: number;
    currentBtcPriceUsd: number;
}

export interface TotalPlatformVolume {
    period: string;
    tpvSats: number;
    tpvUsd: number;
    startTime: string;
    endTime: string;
}

// ─── Leaderboard ────────────────────────────────────────────────────

export interface WalletLeaderboardEntry {
    rank: number;
    sparkAddress: string;
    pubkey: string;
    totalValueSats: number;
    totalValueUsd: number;
}

export interface WalletLeaderboard {
    leaderboard: WalletLeaderboardEntry[];
    currentBtcPriceUsd: number;
}

export interface TokenLeaderboardEntry {
    rank: number;
    tokenIdentifier: string;
    tokenAddress: string;
    issuerPublicKey: string;
    name: string;
    ticker: string;
    decimals: number;
    iconUrl: string;
    holderCount: number;
    priceUsd: number;
    totalSupply: string;
    marketCapUsd: number;
    volume24hUsd: number;
    maxSupply?: string | null;
    isFreezable?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface TokenLeaderboardResponse {
    leaderboard: TokenLeaderboardEntry[];
    totalTokens: number;
}

// ─── Flashnet AMM ───────────────────────────────────────────────

export interface FlashnetPool {
    lpPublicKey: string;
    assetAAddress: string;
    assetBAddress: string;
    assetAReserve: string;
    assetBReserve: string;
    curveType: 'CONSTANT_PRODUCT' | 'SINGLE_SIDED';
    hostName: string;
    hostFeeBps: number;
    lpFeeBps: number;
    createdAt: string;
    updatedAt: string;
    volume24hAssetB: string;
    tvlAssetB: string;
    currentPriceAInB: string;
    priceChangePercent24h: string;
    initialReserveA?: string;
    virtualReserveA?: string;
    virtualReserveB?: string;
    bondingProgressPercent?: string;
    thresholdPct?: number;
}

export interface FlashnetPoolsResponse {
    totalCount: number;
    pools: FlashnetPool[];
}

export interface FlashnetHost {
    namespace: string;
    feeRecipientPublicKey: string;
    minFeeBps: number;
    createdAt: string;
}

export interface FlashnetPingResponse {
    status: string;
    requestId: string;
    gatewayTimestamp: number;
    settlementTimestamp: number;
}

export interface FlashnetSimulateAddLiquidityResponse {
    lpTokensToMint: string;
    assetAAmountToAdd: string;
    assetBAmountToAdd: string;
    assetARefundAmount: string;
    assetBRefundAmount: string;
    poolSharePercentage: string;
    warningMessage?: string;
}

export interface FlashnetSimulateRemoveLiquidityResponse {
    assetAAmount: string;
    assetBAmount: string;
    currentLpBalance: string;
    poolShareRemovedPercentage: string;
    warningMessage?: string;
}

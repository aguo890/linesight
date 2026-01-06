export const MatchTier = {
    HASH: "hash",
    FUZZY: "fuzzy",
    LLM: "llm",
    MANUAL: "manual",
    UNMATCHED: "unmatched",
} as const;

export type MatchTier = typeof MatchTier[keyof typeof MatchTier];

export interface MatchResult {
    canonical: string | null;
    confidence: number;
    tier: MatchTier;
    fuzzy_score?: number | null;
    reasoning?: string | null;
}

export interface ColumnMatchResult {
    source_column: string;
    target_field: string | null;
    confidence: number;
    tier: MatchTier;
    fuzzy_score?: number | null;
    reasoning?: string | null;
    sample_data: any[];
    needs_review: boolean;
    ignored: boolean;
    /**
     * Computed status based on confidence and ignored flags.
     * "ignored" | "auto_mapped" | "needs_review" | "needs_attention"
     */
    status: string;
}

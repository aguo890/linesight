/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

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

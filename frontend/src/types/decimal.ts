/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Decimal Types and Utilities
 * 
 * Centralized handling of Python Decimal <-> TypeScript number conversion.
 * 
 * Problem: Python's Decimal type serializes to JSON as strings to preserve
 * precision (e.g., "85.25" instead of 85.25). This causes type mismatches
 * in the frontend where we expect numbers.
 * 
 * Solution: Use DecimalString type for raw API responses and parseDecimal()
 * for safe conversion to JavaScript numbers.
 */

/**
 * Type representing a decimal value that may come from the backend
 * as either a string (Python Decimal) or number (already parsed).
 */
export type DecimalString = string | number;

/**
 * Safely parse a DecimalString to a JavaScript number.
 * Handles both string (from Python Decimal) and number inputs.
 * 
 * @param value - The value to parse (string or number)
 * @param fallback - Value to return if parsing fails (default: 0)
 * @returns Parsed number or fallback value
 * 
 * @example
 * parseDecimal("85.25")     // 85.25
 * parseDecimal(85.25)       // 85.25
 * parseDecimal("invalid")   // 0
 * parseDecimal(null, 0)     // 0
 */
export function parseDecimal(value: DecimalString | null | undefined, fallback: number = 0): number {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'number') {
        return isNaN(value) ? fallback : value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
            return fallback;
        }
        const parsed = parseFloat(trimmed);
        return isNaN(parsed) ? fallback : parsed;
    }

    return fallback;
}

/**
 * Parse a DecimalString to a percentage (multiply by 100 if <= 1).
 * Useful for efficiency values that come as 0.85 but need to display as 85%.
 * 
 * @param value - The value to parse
 * @param shouldScale - If true, scale values <= 1 by 100 (default: false)
 * @returns Parsed percentage value
 */
export function parseDecimalPercent(value: DecimalString | null | undefined, shouldScale: boolean = false): number {
    const num = parseDecimal(value);
    if (shouldScale && num > 0 && num <= 1) {
        return num * 100;
    }
    return num;
}

/**
 * Format a number for display with specified decimal places.
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @param suffix - Optional suffix like "%" (default: "")
 */
export function formatDecimal(value: number, decimals: number = 1, suffix: string = ''): string {
    return `${value.toFixed(decimals)}${suffix}`;
}

/**
 * Date Types and Utilities
 * 
 * Centralized handling of Date string representations and parsing.
 * 
 * Purpose: 
 * 1. Define strict types for ISO 8601 strings returned by the backend.
 * 2. Provide safe parsing utilities that handle null/undefined/invalid values.
 * 3. Offer Zod schemas for runtime validation.
 */

import { z } from 'zod';

/**
 * ISO 8601 Date String (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
 * This is the standard wire format from our Backend.
 */
export type ISO8601String = string;

/**
 * Common format string for reference, although actual formatting
 * should be done via Intl.DateTimeFormat in hooks.
 */
export const DATE_FORMAT_ISO = 'YYYY-MM-DD';

/**
 * Zod schema for validating API responses.
 * Accepts full ISO datetimes or simple date strings (YYYY-MM-DD).
 */
export const DateStringSchema = z.string().datetime({
    offset: true // Allow UTC offsets 
}).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

/**
 * Safely parse an ISO string to a native Date object.
 * Handles nulls, invalid strings, and creates defensive copies.
 * 
 * @param value - The ISO string or Date object to parsing
 * @returns Date object or null if invalid/missing
 */
export function parseDate(value: ISO8601String | Date | null | undefined): Date | null {
    if (!value) return null;

    // Already a Date object
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : new Date(value.getTime());
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if a string is a valid ISO date string.
 */
export function isValidDateString(value: string): boolean {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
}

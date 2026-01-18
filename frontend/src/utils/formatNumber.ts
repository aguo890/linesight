/**
 * Locale-aware number formatting utilities
 * 
 * Uses Intl.NumberFormat for proper locale-specific formatting:
 * - German: 1.000 (dot as thousands separator)
 * - English: 1,000 (comma as thousands separator)
 * - Arabic: ١٬٠٠٠ (Eastern Arabic numerals with proper separator)
 */

/**
 * Format a number according to the current locale
 * @param value - The number to format
 * @param locale - The locale code (e.g., 'en', 'de', 'ar')
 * @param options - Optional Intl.NumberFormatOptions
 * @returns Formatted number string
 */
export function formatNumber(
    value: number,
    locale: string = 'en',
    options?: Intl.NumberFormatOptions
): string {
    try {
        return new Intl.NumberFormat(locale, options).format(value);
    } catch {
        // Fallback to English formatting if locale is invalid
        return new Intl.NumberFormat('en', options).format(value);
    }
}

/**
 * Format a number as currency (display only, no conversion)
 * Always uses USD symbol but applies locale-specific digit formatting
 * @param value - The number to format
 * @param locale - The locale code
 * @returns Formatted price string (e.g., "$1,000" or "$1.000")
 */
export function formatPrice(
    value: number,
    locale: string = 'en'
): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `$${formatNumber(value, 'en')}`;
    }
}

/**
 * Format a percentage value
 * @param value - The percentage (0-100 scale, not 0-1)
 * @param locale - The locale code
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercent(
    value: number,
    locale: string = 'en',
    decimals: number = 1
): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'percent',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value / 100);
    } catch {
        return `${value.toFixed(decimals)}%`;
    }
}

/**
 * Format a compact number (e.g., 1000 -> "1K", 1000000 -> "1M")
 * @param value - The number to format
 * @param locale - The locale code
 * @returns Compact formatted number string
 */
export function formatCompact(
    value: number,
    locale: string = 'en'
): string {
    try {
        return new Intl.NumberFormat(locale, {
            notation: 'compact',
            compactDisplay: 'short',
        }).format(value);
    } catch {
        return formatNumber(value, 'en');
    }
}

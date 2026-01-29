import { useCallback, useMemo } from 'react';
import { useFactoryContext } from '../contexts/FactoryContext';
// import { parseDate } from '@/types/date'; // Can import if needed for strict parsing

/**
 * Hook to provide date formatting functions that respect the active Factory's locale.
 * 
 * Usage:
 * const { formatDate, formatDateTime } = useDateFormatter();
 * <span>{formatDate(upload.created_at)}</span>
 */
export function useDateFormatter() {
    const { activeFactory } = useFactoryContext();

    // 1. Get Locale (Format: DD/MM vs MM/DD)
    // Fallback to browser locale if no factory selected, or factory has no locale
    const locale = activeFactory?.locale || navigator.language || 'en-US';

    // 2. Get Timezone (Context: When did this actually happen?)
    // Default to 'UTC' if undefined to prevent browser-local bias
    const timeZone = activeFactory?.timezone || 'UTC';

    // Optimization: Memoize the formatter instances
    const dateFormatter = useMemo(() => {
        try {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                timeZone,
            });
        } catch (e) {
            console.warn(`Invalid locale/timezone: ${locale}/${timeZone}`, e);
            return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });
        }
    }, [locale, timeZone]);

    const dateTimeFormatter = useMemo(() => {
        try {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone,
            });
        } catch (e) {
            console.warn(`Invalid locale/timezone: ${locale}/${timeZone}`, e);
            return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });
        }
    }, [locale, timeZone]);

    /**
     * Format a date string or object to a short date string (e.g. "01/06/2025" or "1/6/2025")
     */
    const formatDate = useCallback((dateStr: string | Date | null | undefined) => {
        if (!dateStr) return 'N/A';
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';

        return dateFormatter.format(date);
    }, [dateFormatter]);

    /**
     * Format a date string or object to a date & time string
     */
    const formatDateTime = useCallback((dateStr: string | Date | null | undefined) => {
        if (!dateStr) return 'N/A';
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';

        return dateTimeFormatter.format(date);
    }, [dateTimeFormatter]);

    /**
     * Helper to safely format relative to now if needed in future
     * (e.g. "2 hours ago"). For now we just return standard formats.
     */

    return { formatDate, formatDateTime, locale, timeZone };
}

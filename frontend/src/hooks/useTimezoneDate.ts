/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useMemo, useCallback } from 'react';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { useFactoryContext } from '@/contexts/FactoryContext';

/**
 * Hook to provide date manipulation functions that strictly respect a target timezone.
 * 
 * @param explicitTimezone Optional. If provided, overrides the active factory's timezone.
 */
export function useTimezoneDate(explicitTimezone?: string) {
    // 1. Try Global Context (Smart Default)
    // We try/catch here or just handle the possible error if used outside provider (though unlikely for this hook usage)
    let activeFactory = null;
    try {
        const ctx = useFactoryContext();
        activeFactory = ctx.activeFactory;
    } catch (e) {
        // Allow hook to be used in isolation if explicitTimezone is passed
    }

    // 2. Determine Effective Timezone
    // Priority: Explicit Prop > Active Factory > Fallback UTC
    const timeZone = useMemo(() => {
        if (explicitTimezone) return explicitTimezone;
        if (activeFactory?.timezone) return activeFactory.timezone;
        return 'UTC';
    }, [explicitTimezone, activeFactory?.timezone]);

    // Validation (Intl safety)
    const validTimeZone = useMemo(() => {
        try {
            Intl.DateTimeFormat(undefined, { timeZone });
            return timeZone;
        } catch (e) {
            console.error(`Invalid timezone "${timeZone}". Falling back to UTC.`);
            return 'UTC';
        }
    }, [timeZone]);

    /**
     * Get the current "Now" in the Factory's timezone.
     * Returns a Date object that represents the current wall-clock time in that zone.
     * Note: This "Date" object is conceptually "Timezoned", but JS Dates are UTC.
     * Only use this for extracting components (year, month, day) or relative math.
     */
    const getFactoryNow = useCallback(() => {
        return toZonedTime(new Date(), validTimeZone);
    }, [validTimeZone]);

    /**
     * Helper: Get the current wall-clock date string (YYYY-MM-DD) for the factory.
     */
    const getFactoryDateString = useCallback((date: Date = new Date()) => {
        return format(toZonedTime(date, validTimeZone), 'yyyy-MM-dd', { timeZone: validTimeZone });
    }, [validTimeZone]);

    /**
     * Get the exact UTC Start of Today for the Factory.
     * Logic: Now (UTC) -> Factory Wall Time -> Start of Day (Factory Wall Time) -> UTC
     * Example: If Factory is UTC+7 and it's 2025-01-07 10:00 AM there.
     * "Today" Start is 2025-01-07 00:00:00 UTC+7 -> 2025-01-06 17:00:00 UTC.
     */
    const getFactoryStartOfToday = useCallback(() => {
        const now = new Date(); // Current system UTC
        const zonedNow = toZonedTime(now, validTimeZone); // Shift to factory wall time components
        const zonedStartOfDay = startOfDay(zonedNow); // 00:00:00 of that wall time
        return fromZonedTime(zonedStartOfDay, validTimeZone); // Shift back to true UTC
    }, [validTimeZone]);

    /**
     * Get the exact UTC End of Today for the Factory.
     */
    const getFactoryEndOfToday = useCallback(() => {
        const now = new Date();
        const zonedNow = toZonedTime(now, validTimeZone);
        const zonedEndOfDay = endOfDay(zonedNow);
        return fromZonedTime(zonedEndOfDay, validTimeZone);
    }, [validTimeZone]);

    /**
     * Convert a UTC Date to the Factory's YYYY-MM-DD string (for inputs).
     */
    const toFactoryDateInputValue = useCallback((date: Date | null | undefined) => {
        if (!date) return '';
        return format(toZonedTime(date, validTimeZone), 'yyyy-MM-dd', { timeZone: validTimeZone });
    }, [validTimeZone]);

    /**
     * Convert an Input string (YYYY-MM-DD) back to that day's START in UTC (for API).
     * Input: "2025-01-07" (implied Factory Time)
     * Output: 2025-01-06T17:00:00.000Z (if UTC+7)
     */
    const fromFactoryDateInputValue = useCallback((dateStr: string) => {
        if (!dateStr) return null;
        // Interpret strict YYYY-MM-DD as 00:00:00 in the target timezone.
        // fromZonedTime takes a string "2025-01-07 00:00:00" and a timezone, 
        // and returns the UTC date that corresponds to that wall time.
        return fromZonedTime(`${dateStr} 00:00:00`, validTimeZone);
    }, [validTimeZone]);

    /**
     * Subtract days respecting the factory timezone.
     * Logic: UTC -> Zoned -> subDays -> UTC
     */
    const subtractFactoryDays = useCallback((date: Date, amount: number) => {
        // 1. Convert absolute UTC to Factory Wall Time
        const zoned = toZonedTime(date, validTimeZone);
        // 2. Perform math on the Wall Time (safe for DST transitions usually, as 1 day is 1 calendar day)
        const subtracted = subDays(zoned, amount);
        // 3. Convert back to absolute UTC
        return fromZonedTime(subtracted, validTimeZone);
    }, [validTimeZone]);

    /**
     * Safe helper to get End of Day from a given Start of Day (in Factory Time)
     * Useful for setting ranges like [Start, End]
     */
    const getEndOfFactoryDay = useCallback((startDate: Date) => {
        const zoned = toZonedTime(startDate, validTimeZone);
        const end = endOfDay(zoned);
        return fromZonedTime(end, validTimeZone);
    }, [validTimeZone]);

    return {
        timeZone: validTimeZone,
        getFactoryNow,
        getFactoryDateString,
        getFactoryStartOfToday,
        getFactoryEndOfToday,
        toFactoryDateInputValue,
        fromFactoryDateInputValue,
        subtractFactoryDays,
        getEndOfFactoryDay
    };
}

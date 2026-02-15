/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { toRegionLocale, detectBestLocale } from '../utils/localeUtils';

// Define default options OUTSIDE the hook to maintain reference stability
const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
};

/**
 * Hook to provide formatting functions that respect the User's personal locale preference.
 * This decouples translation language from data formatting (Dates/Currencies).
 * Optimized for performance in large lists.
 */
export const useLocaleFormatter = () => {
    const { user } = useAuth();
    const userLocale = user?.preferences?.locale;

    // Fallback to browser preference if user isn't logged in, or default to US
    const locale = useMemo(() => {
        if (userLocale) {
            return toRegionLocale(userLocale);
        }
        return detectBestLocale();
    }, [userLocale]);

    // Optimization: For heavy lists, we can reuse the "Default" formatter
    // This creates the expensive Intl object ONLY when locale changes, not on every render
    const defaultDateFormatter = useMemo(() => {
        return new Intl.DateTimeFormat(locale, DEFAULT_DATE_OPTIONS);
    }, [locale]);

    const formatDate = useCallback((date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';

        // Optimization: If no custom options are passed, use the cached formatter instance
        if (!options) {
            return defaultDateFormatter.format(d);
        }

        // Fallback: Create new instance only when custom options are needed (slower but flexible)
        return new Intl.DateTimeFormat(locale, options).format(d);
    }, [locale, defaultDateFormatter]);

    const formatCurrency = useCallback((amount: number, currency = 'USD') => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency
        }).format(amount);
    }, [locale]);

    const formatNumber = useCallback((amount: number, options: Intl.NumberFormatOptions = {}) => {
        return new Intl.NumberFormat(locale, options).format(amount);
    }, [locale]);

    return {
        formatDate,
        formatCurrency,
        formatNumber,
        currentLocale: locale
    };
};

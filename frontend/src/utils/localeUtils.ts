/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

export const SUPPORTED_LOCALES = [
    { label: 'English (US)', value: 'en-US', short: 'en' },
    { label: 'Español', value: 'es-ES', short: 'es' },
    { label: 'العربية (Arabic)', value: 'ar-EG', short: 'ar' },
    { label: '中文 (Chinese)', value: 'zh-CN', short: 'zh' },
    { label: 'Français (French)', value: 'fr-FR', short: 'fr' },
    { label: 'Deutsch (German)', value: 'de-DE', short: 'de' },
    { label: '日本語 (Japanese)', value: 'ja-JP', short: 'ja' },
    { label: 'Português (Portuguese)', value: 'pt-BR', short: 'pt' },
    { label: 'हिन्दी (Hindi)', value: 'hi-IN', short: 'hi' },
    { label: 'বাংলা (Bengali)', value: 'bn-BD', short: 'bn' },
    { label: 'Tiếng Việt (Vietnamese)', value: 'vi-VN', short: 'vi' },
    { label: 'Türkçe (Turkish)', value: 'tr-TR', short: 'tr' },
    { label: 'Italiano (Italian)', value: 'it-IT', short: 'it' },
    { label: 'اردو (Urdu)', value: 'ur-PK', short: 'ur' },
    { label: '한국어 (Korean)', value: 'ko-KR', short: 'ko' },
    { label: 'Русский (Russian)', value: 'ru-RU', short: 'ru' },
    { label: 'Nederlands (Dutch)', value: 'nl-NL', short: 'nl' },
] as const;

export type ShortLocale = typeof SUPPORTED_LOCALES[number]['short'];
export type RegionLocale = typeof SUPPORTED_LOCALES[number]['value'];

/**
 * Gets the full config for a given locale string (supports both short and region codes)
 */
export const getLocaleConfig = (code: string) => {
    return SUPPORTED_LOCALES.find(l => l.value === code || l.short === code)
        || SUPPORTED_LOCALES[0];
};

/**
 * Converts any locale string to its short form (e.g. 'en-US' -> 'en')
 * Used primarily for i18next language switching.
 */
export const toShortLocale = (code: string): string => {
    const config = SUPPORTED_LOCALES.find(l => l.value === code || l.short === code);
    if (config) return config.short;
    return code.split('-')[0] || 'en';
};

/**
 * Converts any locale string to its full region form (e.g. 'en' -> 'en-US')
 * Used for persisting to database/state as the source of truth.
 */
export const toRegionLocale = (code: string): string => {
    const config = SUPPORTED_LOCALES.find(l => l.value === code || l.short === code);
    if (config) return config.value;
    return code; // Return as-is if no mapping found
};

/**
 * Detects the best supported locale based on the user's browser settings.
 * Returns a Region Code (e.g., 'es-ES')
 */
export const detectBestLocale = (): RegionLocale => {
    if (typeof navigator === 'undefined') return 'en-US';

    // 1. Get browser languages (e.g., ['en-GB', 'en', 'fr'])
    const browserLangs = navigator.languages || [navigator.language];

    for (const lang of browserLangs) {
        // 2. Try Exact Match (e.g. browser 'es-ES' === supported 'es-ES')
        const exact = SUPPORTED_LOCALES.find(l => l.value === lang);
        if (exact) return exact.value;

        // 3. Try Loose Match (e.g. browser 'es-MX' -> matches 'es' short code)
        const short = lang.split('-')[0];
        const loose = SUPPORTED_LOCALES.find(l => l.short === short);
        if (loose) return loose.value;
    }

    // 4. Ultimate Fallback
    return 'en-US';
};

/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

// Centralized locale configuration - Single Source of Truth
// This prevents hardcoding the language list in multiple places

export const LOCALES = {
    en: { name: "English", flag: "🇺🇸", dir: "ltr" },
    es: { name: "Español", flag: "🇪🇸", dir: "ltr" },
    ar: { name: "العربية", flag: "🇸🇦", dir: "rtl" },
    zh: { name: "中文", flag: "🇨🇳", dir: "ltr" },
    de: { name: "Deutsch", flag: "🇩🇪", dir: "ltr" },
    fr: { name: "Français", flag: "🇫🇷", dir: "ltr" },
    ja: { name: "日本語", flag: "🇯🇵", dir: "ltr" },
    ko: { name: "한국어", flag: "🇰🇷", dir: "ltr" },
    it: { name: "Italiano", flag: "🇮🇹", dir: "ltr" },
    pt: { name: "Português", flag: "🇧🇷", dir: "ltr" },
    ru: { name: "Русский", flag: "🇷🇺", dir: "ltr" },
    nl: { name: "Nederlands", flag: "🇳🇱", dir: "ltr" },
    tr: { name: "Türkçe", flag: "🇹🇷", dir: "ltr" },
    vi: { name: "Tiếng Việt", flag: "🇻🇳", dir: "ltr" },
    hi: { name: "हिन्दी", flag: "🇮🇳", dir: "ltr" },
    bn: { name: "বাংলা", flag: "🇧🇩", dir: "ltr" },
    ur: { name: "اردو", flag: "🇵🇰", dir: "rtl" },
} as const;

export type LocaleCode = keyof typeof LOCALES;
export const DEFAULT_LOCALE: LocaleCode = 'en';
export const SUPPORTED_LOCALES = Object.keys(LOCALES) as LocaleCode[];

/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, SUPPORTED_LOCALES, type LocaleCode, DEFAULT_LOCALE } from '../../context/config/locales';

/**
 * LanguageWrapper - Wraps public routes with locale-based routing
 * 
 * Reads the :lang param from the URL and syncs it with i18n.
 * Handles RTL/LTR direction switching automatically using centralized config.
 * 
 * Usage in router:
 * <Route path="/:lang" element={<LanguageWrapper />}>
 *   <Route index element={<LandingPage />} />
 * </Route>
 */
export const LanguageWrapper: React.FC = () => {
    const { lang } = useParams<{ lang: string }>();
    const { i18n } = useTranslation();
    const location = useLocation();

    // Check if locale is valid (used both for redirect logic and effect)
    const isValidLocale = lang && SUPPORTED_LOCALES.includes(lang as LocaleCode);
    const validLocale = isValidLocale ? (lang as LocaleCode) : DEFAULT_LOCALE;

    // Sync URL language -> i18n state
    // IMPORTANT: This hook must be called before any early returns (React rules of hooks)
    useEffect(() => {
        // Only sync if we have a valid locale (redirect will handle invalid cases)
        if (!isValidLocale) return;

        if (lang && i18n.language !== lang) {
            i18n.changeLanguage(lang);
        }

        // Handle RTL/LTR direction using centralized config
        const localeConfig = LOCALES[validLocale];
        document.documentElement.dir = localeConfig.dir;
        document.documentElement.lang = validLocale;

    }, [lang, validLocale, i18n, isValidLocale]);

    // Guard: Redirect invalid locales to default (English)
    if (!isValidLocale) {
        // Preserve the path after the invalid lang for better UX
        // e.g., /xyz/pricing -> /en/pricing
        const pathAfterLang = location.pathname.split('/').slice(2).join('/');
        const redirectPath = pathAfterLang ? `/${DEFAULT_LOCALE}/${pathAfterLang}` : `/${DEFAULT_LOCALE}`;
        return <Navigate to={redirectPath} replace state={{ from: location }} />;
    }

    return <Outlet />;
};

export default LanguageWrapper;


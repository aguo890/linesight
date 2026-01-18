import { useEffect } from 'react';
import { useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, SUPPORTED_LOCALES, type LocaleCode, DEFAULT_LOCALE } from '../../config/locales';

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

    // Guard: Redirect invalid locales to default (English)
    if (!lang || !SUPPORTED_LOCALES.includes(lang as LocaleCode)) {
        // Preserve the path after the invalid lang for better UX
        // e.g., /xyz/pricing -> /en/pricing
        const pathAfterLang = location.pathname.split('/').slice(2).join('/');
        const redirectPath = pathAfterLang ? `/${DEFAULT_LOCALE}/${pathAfterLang}` : `/${DEFAULT_LOCALE}`;
        return <Navigate to={redirectPath} replace state={{ from: location }} />;
    }

    const validLocale = lang as LocaleCode;

    // Sync URL language -> i18n state
    useEffect(() => {
        if (lang && i18n.language !== lang) {
            i18n.changeLanguage(lang);
        }

        // Handle RTL/LTR direction using centralized config
        const localeConfig = LOCALES[validLocale];
        document.documentElement.dir = localeConfig.dir;
        document.documentElement.lang = validLocale;

    }, [lang, validLocale, i18n]);

    return <Outlet />;
};

export default LanguageWrapper;


import { useEffect } from 'react';
import './index.css';
import { AppRouter } from './router';
import { DashboardProvider } from './features/dashboard/context/DashboardContext';
import { FactoryProvider } from './contexts/FactoryContext';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { toShortLocale } from './utils/localeUtils';
import { getPrefs } from './features/user/utils';

function App() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { setTheme, theme } = useTheme();

  // SYNC: Database theme preference -> ThemeContext
  // This runs when user logs in or when profile is updated
  useEffect(() => {
    if (user) {
      // Sync Theme
      const dbTheme = getPrefs(user).theme as 'light' | 'dark' | 'system' | undefined;
      // SAFE SYNC: Only override local state if the DB source of truth is actually different.
      // This allows local "previews" to exist without being immediately overwritten by the old DB state.
      if (dbTheme && dbTheme !== theme) {
        setTheme(dbTheme);
      }

      // Sync Locale
      const dbLocale = getPrefs(user).locale;
      if (dbLocale) {
        const shortLocale = toShortLocale(dbLocale);
        // Only update language if DB value differs from current
        if (shortLocale !== i18n.language) {
          i18n.changeLanguage(shortLocale);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle RTL/LTR direction based on language
  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <FactoryProvider>
      <DashboardProvider>
        <AppRouter />
      </DashboardProvider>
    </FactoryProvider>
  );
}

export default App;

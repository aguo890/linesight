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
      // Only update theme if it differs from current and is defined in DB
      if (dbTheme && dbTheme !== theme) {
        setTheme(dbTheme);
      }

      // Sync Locale
      const dbLocale = getPrefs(user).locale;
      if (dbLocale) {
        const shortLocale = toShortLocale(dbLocale);
        // Only update language if DB value differs from current
        // AND this effect was triggered by a user upate (implied by dependency array)
        if (shortLocale !== i18n.language) {
          i18n.changeLanguage(shortLocale);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, setTheme, theme]);

  return (
    <FactoryProvider>
      <DashboardProvider>
        <AppRouter />
      </DashboardProvider>
    </FactoryProvider>
  );
}

export default App;

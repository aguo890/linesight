import { useEffect } from 'react';
import './index.css';
import { AppRouter } from './router';
import { DashboardProvider } from './features/dashboard/context/DashboardContext';
import { FactoryProvider } from './contexts/FactoryContext';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './context/ThemeContext';
import { getPrefs } from './features/user/utils';

function App() {
  const { user } = useAuth();
  const { setTheme, theme } = useTheme();

  // SYNC: Database theme preference -> ThemeContext
  // This runs when user logs in or when profile is updated
  useEffect(() => {
    if (user) {
      const dbTheme = getPrefs(user).theme as 'light' | 'dark' | 'system' | undefined;

      // Only sync if DB has a value and it differs from current theme
      if (dbTheme && dbTheme !== theme) {
        setTheme(dbTheme);
      }
    }
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

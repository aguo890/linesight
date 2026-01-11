import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Get the initial theme from localStorage or system preference.
 * This matches the blocking script in index.html.
 */
function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';

    try {
        const saved = localStorage.getItem('theme') as Theme | null;
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
            return saved;
        }
    } catch {
        // localStorage not available
    }

    return 'system';
}

/**
 * Resolve 'system' theme to actual light/dark based on media query.
 */
function resolveTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'system') {
        if (typeof window === 'undefined') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
}

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => defaultTheme ?? getInitialTheme());
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(theme));

    // Update the DOM and localStorage when theme changes
    useEffect(() => {
        const resolved = resolveTheme(theme);
        setResolvedTheme(resolved);

        // Update DOM
        const root = document.documentElement;
        if (resolved === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Persist to localStorage
        try {
            localStorage.setItem('theme', theme);
        } catch {
            // localStorage not available
        }
    }, [theme]);

    // Listen for system preference changes when theme is 'system'
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            const newResolved = e.matches ? 'dark' : 'light';
            setResolvedTheme(newResolved);

            const root = document.documentElement;
            if (newResolved === 'dark') {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState(prev => {
            const currentResolved = resolveTheme(prev);
            return currentResolved === 'light' ? 'dark' : 'light';
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

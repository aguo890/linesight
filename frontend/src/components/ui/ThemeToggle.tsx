import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun, Monitor } from 'lucide-react';

/**
 * Theme toggle button with three states: Light, Dark, System.
 * Cycles through: light -> dark -> system -> light
 */
export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();

    const handleClick = () => {
        if (theme === 'light') {
            setTheme('dark');
        } else if (theme === 'dark') {
            setTheme('system');
        } else {
            setTheme('light');
        }
    };

    const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
    const label = theme === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Dark' : 'Light';

    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                 bg-surface hover:bg-surface-elevated
                 border border-border text-text-main"
            aria-label={`Current theme: ${label}. Click to change.`}
            title={`Theme: ${label}`}
        >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

/**
 * Minimal icon-only theme toggle.
 */
export function ThemeToggleIcon() {
    const { toggleTheme, resolvedTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors
                 hover:bg-surface-elevated text-text-muted hover:text-text-main"
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {resolvedTheme === 'dark' ? (
                <Sun className="w-5 h-5" />
            ) : (
                <Moon className="w-5 h-5" />
            )}
        </button>
    );
}

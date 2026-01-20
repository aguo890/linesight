import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LOCALES, type LocaleCode } from '../../context/config/locales';

/**
 * LanguageSwitcher - Dropdown component for switching languages
 * Detects current locale from URL and redirects to the same path in the new locale
 */
export default function LanguageSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const pathName = location.pathname;

    // Detect current locale from URL (e.g., /es/pricing -> es)
    const pathSegments = pathName.split('/').filter(Boolean);
    const urlLocale = pathSegments[0] as LocaleCode;
    const currentLocale = LOCALES[urlLocale] ? urlLocale : 'en';
    const activeLang = LOCALES[currentLocale];

    // Handle Click Outside to close dropdown (Accessibility/UX)
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle Language Switch
    const handleSwitch = (newLocale: string) => {
        // Replace the first segment of the URL with the new locale
        // Ex: /en/pricing -> /es/pricing
        const segments = pathName.split('/').filter(Boolean);

        // Check if first segment is a known locale
        if (LOCALES[segments[0] as LocaleCode]) {
            segments[0] = newLocale;
        } else {
            // No locale in URL, prepend it
            segments.unshift(newLocale);
        }

        const newPath = '/' + segments.join('/');

        // Full reload ensures fonts update correctly for CJK languages
        window.location.href = newPath;
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors
          border-slate-200 bg-white text-slate-700 hover:bg-slate-50
          dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700
          focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label="Select language"
            >
                <span className="text-lg leading-none">{activeLang.flag}</span>
                <span className="hidden sm:inline">{activeLang.name}</span>
                {/* Chevron Icon */}
                <svg
                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50 max-h-80 overflow-y-auto
            bg-white dark:bg-slate-800"
                    role="listbox"
                    aria-label="Languages"
                >
                    <div className="py-1">
                        {Object.entries(LOCALES).map(([code, data]) => (
                            <button
                                key={code}
                                onClick={() => handleSwitch(code)}
                                role="option"
                                aria-selected={currentLocale === code}
                                className={`
                  flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors
                  hover:bg-slate-100 dark:hover:bg-slate-700
                  ${currentLocale === code
                                        ? 'bg-blue-50 font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'text-slate-700 dark:text-slate-200'
                                    }
                `}
                            >
                                <span className="text-xl">{data.flag}</span>
                                <span>{data.name}</span>
                                {currentLocale === code && (
                                    <svg className="ml-auto h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

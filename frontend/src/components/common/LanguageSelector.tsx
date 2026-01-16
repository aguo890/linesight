import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';



import { SUPPORTED_LOCALES, toShortLocale, toRegionLocale } from '@/utils/localeUtils';

interface LanguageSelectorProps {
    className?: string;
    value?: string;
    onPreferenceChange?: (key: string, value: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className, value, onPreferenceChange }) => {
    const { i18n } = useTranslation();
    const { user, updateUser } = useAuth(); // Deconstruct here

    // Determine current value (source of truth is the full region code)
    // If 'value' prop is missing (uncontrolled), we map i18n.language back to a full code
    const currentValue = value || toRegionLocale(i18n.language);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRegionCode = e.target.value;
        const shortCode = toShortLocale(newRegionCode);

        // Only update global i18n immediately if NOT controlled (no 'value' prop)
        if (!value) {
            i18n.changeLanguage(shortCode);
        }

        if (onPreferenceChange) {
            onPreferenceChange('locale', newRegionCode);
            return;
        }

        if (user) {
            // Persist to backend without blocking UI
            updateUser({
                preferences: {
                    ...user.preferences,
                    locale: newRegionCode
                }
            }).catch(console.error);
        }
    };

    return (
        <select
            value={currentValue}
            onChange={handleChange}
            className={className || "w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"}
        >
            {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc.value} value={loc.value}>
                    {loc.label} ({loc.short})
                </option>
            ))}
        </select>
    );
};

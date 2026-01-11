import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';



interface LanguageSelectorProps {
    className?: string;
    onPreferenceChange?: (key: string, value: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className }) => {
    const { i18n } = useTranslation();
    const { user, updateUser } = useAuth(); // Deconstruct here

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value;
        i18n.changeLanguage(newLang);

        if (user) {
            // Persist to backend without blocking UI
            updateUser({
                preferences: {
                    ...user.preferences,
                    locale: newLang
                }
            }).catch(console.error);
        }
    };

    return (
        <select
            value={i18n.language}
            onChange={handleChange}
            className={className || "w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"}
        >
            <option value="en">English (US)</option>
            <option value="es">Spanish</option>
            <option value="ar">Arabic</option>
            <option value="zh">中文 (Mandarin)</option>
        </select>
    );
};

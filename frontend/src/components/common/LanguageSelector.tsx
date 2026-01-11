import React from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
    className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className }) => {
    const { i18n } = useTranslation();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        i18n.changeLanguage(e.target.value);
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
        </select>
    );
};

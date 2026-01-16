/**
 * Settings Page Header
 * 
 * Standardized header for settings sub-pages with "Back to Settings" navigation.
 * Part of the "Drill-Down" pattern - replaces the nested sidebar.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface SettingsPageHeaderProps {
    title: string;
    description?: string;
    /** Optional: Override the back link destination (defaults to /organization/settings) */
    backTo?: string;
    /** Optional: Custom back link text */
    backLabel?: string;
}

export const SettingsPageHeader: React.FC<SettingsPageHeaderProps> = ({
    title,
    description,
    backTo = '/organization/settings',
    backLabel
}) => {
    const { t } = useTranslation();
    const label = backLabel ?? t('layout.settings_header.back_to_settings');
    return (
        <div className="mb-6">
            <Link
                to={backTo}
                className="inline-flex items-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4 transition-colors group"
            >
                <ArrowLeft
                    size={16}
                    className="mr-1.5 transition-transform group-hover:-translate-x-0.5"
                />
                {label}
            </Link>
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)]">{title}</h1>
                {description && (
                    <p className="mt-1 text-[var(--color-text-muted)]">{description}</p>
                )}
            </div>
        </div>
    );
};

export default SettingsPageHeader;

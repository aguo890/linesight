/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Organization Settings Hub
 * 
 * A "Control Panel" style landing page for organization settings.
 * Uses card grid pattern (Stripe/Apple style) for discoverability.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    Building2,
    Users,
    Factory,
    ShieldCheck,
    CreditCard
} from 'lucide-react';

interface SettingsCard {
    title: string;
    description: string;
    to: string;
    icon: React.ElementType;
    color: string;
    iconColor: string;
    disabled?: boolean;
    badge?: string;
}

const OrganizationSettingsHub: React.FC = () => {
    const { t } = useTranslation();

    const settingsCards: SettingsCard[] = [
        {
            title: t('organization_settings.cards.general.title'),
            description: t('organization_settings.cards.general.description'),
            to: 'general',
            icon: Building2,
            color: 'bg-blue-50 dark:bg-blue-900/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            title: t('organization_settings.cards.members.title'),
            description: t('organization_settings.cards.members.description'),
            to: 'members',
            icon: Users,
            color: 'bg-emerald-50 dark:bg-emerald-900/20',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            title: t('organization_settings.cards.infrastructure.title'),
            description: t('organization_settings.cards.infrastructure.description'),
            to: 'factories',
            icon: Factory,
            color: 'bg-amber-50 dark:bg-amber-900/20',
            iconColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            title: t('organization_settings.cards.security.title'),
            description: t('organization_settings.cards.security.description'),
            to: '',
            icon: ShieldCheck,
            color: 'bg-[var(--color-border)]/30',
            iconColor: 'text-[var(--color-text-subtle)]',
            disabled: true,
            badge: t('organization_settings.badges.coming_soon'),
        },
        {
            title: t('organization_settings.cards.billing.title'),
            description: t('organization_settings.cards.billing.description'),
            to: '',
            icon: CreditCard,
            color: 'bg-[var(--color-border)]/30',
            iconColor: 'text-[var(--color-text-subtle)]',
            disabled: true,
            badge: t('organization_settings.badges.coming_soon'),
        },
    ];

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">
                    {t('organization_settings.title')}
                </h1>
                <p className="text-[var(--color-text-muted)] mt-1">
                    {t('organization_settings.description')}
                </p>
            </div>

            {/* Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {settingsCards.map((card) => {
                    const CardIcon = card.icon;

                    const cardContent = (
                        <div
                            className={`
                relative rounded-xl border p-6 transition-all duration-200 h-full
                ${card.disabled
                                    ? 'border-[var(--color-border)] bg-[var(--color-surface)] cursor-not-allowed opacity-60'
                                    : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-primary)]/40 hover:shadow-md dark:hover:shadow-none cursor-pointer group'
                                }
              `}
                        >
                            {/* Icon Container */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${card.color}`}>
                                <CardIcon className={`w-6 h-6 ${card.iconColor}`} />
                            </div>

                            {/* Badge for disabled cards */}
                            {card.badge && (
                                <span className="absolute top-4 right-4 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--color-border)] text-[var(--color-text-subtle)] rounded">
                                    {card.badge}
                                </span>
                            )}

                            {/* Title */}
                            <h3 className={`font-semibold text-lg mb-1.5 ${card.disabled
                                ? 'text-[var(--color-text-muted)]'
                                : 'text-[var(--color-text)] group-hover:text-[var(--color-primary)]'
                                }`}>
                                {card.title}
                            </h3>

                            {/* Description */}
                            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                {card.description}
                            </p>
                        </div>
                    );

                    if (card.disabled) {
                        return <div key={card.title}>{cardContent}</div>;
                    }

                    return (
                        <Link
                            key={card.title}
                            to={card.to}
                            className="block"
                        >
                            {cardContent}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default OrganizationSettingsHub;

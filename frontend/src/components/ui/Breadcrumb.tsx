/**
 * Breadcrumb Navigation Component
 * 
 * Displays a hierarchical navigation trail (e.g., Workspace > Factory > Line).
 * Each segment except the last is clickable for navigation.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
    const { t } = useTranslation();

    return (
        <nav aria-label={t('components.breadcrumb.aria_label')} className={`flex items-center text-sm ${className}`}>
            <ol className="flex items-center">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <li key={`${item.label}-${index}`} className="flex items-center">
                            {index > 0 && (
                                <ChevronRight className="h-4 w-4 text-text-muted mx-2 flex-shrink-0 rtl:rotate-180" />
                            )}

                            {isLast ? (
                                <span
                                    className="font-semibold text-text-main truncate max-w-[200px] md:max-w-none"
                                    aria-current="page"
                                >
                                    {item.label}
                                </span>
                            ) : (
                                <Link
                                    to={item.href || '#'}
                                    className="text-text-muted hover:text-brand transition-colors duration-200"
                                >
                                    {item.label}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumb;

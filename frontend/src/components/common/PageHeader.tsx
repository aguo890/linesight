/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * PageHeader Component
 * 
 * Reusable page header with optional breadcrumb navigation, title, and actions.
 * Provides consistent header styling across all pages.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface BreadcrumbItem {
    /** Display label */
    label: string;
    /** Navigation path (optional - last item typically has no path) */
    path?: string;
}

export interface PageHeaderProps {
    /** Page title */
    title: string;
    /** Optional subtitle */
    subtitle?: string;
    /** Breadcrumb navigation items */
    breadcrumbs?: BreadcrumbItem[];
    /** Back button configuration (simpler than breadcrumbs) */
    backButton?: {
        label: string;
        path: string;
    };
    /** Right-aligned action buttons */
    actions?: React.ReactNode;
    /** Additional className for container */
    className?: string;
}

// =============================================================================
// Component
// =============================================================================

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    breadcrumbs,
    backButton,
    actions,
    className = '',
}) => {
    const navigate = useNavigate();

    return (
        <div className={`mb-6 ${className}`}>
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                            {crumb.path ? (
                                <button
                                    onClick={() => navigate(crumb.path!)}
                                    className="hover:text-gray-900 transition-colors"
                                >
                                    {crumb.label}
                                </button>
                            ) : (
                                <span className="text-gray-900 font-medium">{crumb.label}</span>
                            )}
                            {index < breadcrumbs.length - 1 && (
                                <span className="text-gray-300">/</span>
                            )}
                        </React.Fragment>
                    ))}
                </nav>
            )}

            {/* Back Button (alternative to breadcrumbs) */}
            {backButton && !breadcrumbs && (
                <button
                    onClick={() => navigate(backButton.path)}
                    className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {backButton.label}
                </button>
            )}

            {/* Title and Actions */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    {subtitle && (
                        <p className="text-gray-500 mt-1">{subtitle}</p>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-3">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PageHeader;

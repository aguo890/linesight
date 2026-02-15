/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * EmptyState Component
 * 
 * Reusable empty state display for lists, grids, and content areas.
 * Provides consistent styling with customizable icon, title, description, and action.
 */
import React from 'react';
import { type LucideIcon, Inbox } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface EmptyStateProps {
    /** Icon component to display */
    icon?: LucideIcon;
    /** Title text */
    title: string;
    /** Description text */
    description?: string;
    /** Action button */
    action?: {
        label: string;
        onClick: () => void;
    };
    /** Additional className */
    className?: string;
}

// =============================================================================
// Component
// =============================================================================

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon = Inbox,
    title,
    description,
    action,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-12 ${className}`}>
            <div className="p-4 bg-surface-subtle rounded-full mb-4">
                <Icon className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-text-main mb-1">{title}</h3>
            {description && (
                <p className="text-text-muted max-w-sm mb-4">{description}</p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    className="text-brand font-semibold hover:text-brand-dark hover:underline transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};

export default EmptyState;

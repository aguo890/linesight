/**
 * DashboardEmptyState Component
 * 
 * Displays when a dashboard has no widgets.
 * Extracted from DynamicDashboardPage for modularity.
 */
import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// =============================================================================
// Types
// =============================================================================

export interface DashboardEmptyStateProps {
    /** Open the designer/edit mode */
    onOpenDesigner: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
    onOpenDesigner,
}) => {
    const { t } = useTranslation();

    return (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-border rounded-3xl m-10">
            <div className="p-6 bg-surface-subtle rounded-full">
                <LayoutGrid className="w-12 h-12 text-text-muted/50" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-text-main">{t('dashboard_page.empty_state.title')}</h3>
                <p className="text-text-muted max-w-xs">{t('dashboard_page.empty_state.description')}</p>
            </div>
            <button onClick={onOpenDesigner} className="text-brand font-bold hover:underline">
                {t('dashboard_page.empty_state.action')}
            </button>
        </div>
    );
};

export default DashboardEmptyState;


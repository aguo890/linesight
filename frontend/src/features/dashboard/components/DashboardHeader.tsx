/**
 * DashboardHeader Component
 * 
 * Displays the dashboard title, live status indicator, data source badge,
 * and edit mode controls. Extracted from DynamicDashboardPage for modularity.
 */
import React from 'react';
import { LayoutGrid, Loader2, Settings, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // [I18N]
import { Breadcrumb } from '../../../components/ui/Breadcrumb';

// =============================================================================
// Types
// =============================================================================

export interface DashboardHeaderProps {
    /** Dashboard name to display */
    dashboardName: string | undefined;
    /** Data source name for badge */
    dataSourceName: string | undefined;
    /** Factory ID for back navigation */
    factoryId: string | undefined;
    /** Factory name for breadcrumb */
    factoryName: string | undefined;
    /** Whether edit mode is active */
    editMode: boolean;
    /** Toggle edit mode */
    onEditModeToggle: () => void;
    /** Open widget library */
    onOpenLibrary: () => void;
    /** Whether layout is being saved */
    isSaving: boolean;
    /** Last update timestamp */
    lastUpdated: string;
}

// =============================================================================
// Component
// =============================================================================

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    dashboardName,
    dataSourceName,
    factoryId,
    factoryName,
    editMode,
    onEditModeToggle,
    onOpenLibrary,
    isSaving,
    lastUpdated,
}) => {
    const { t } = useTranslation(); // [I18N]

    return (
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="max-w-[1600px] mx-auto">
                {/* Breadcrumb Navigation */}
                <Breadcrumb
                    items={[
                        { label: t('dashboard_header.breadcrumbs.workspace'), href: '/dashboard/factories' },
                        ...(factoryId ? [{ label: factoryName || t('dashboard_header.breadcrumbs.factory'), href: `/dashboard/factories/${factoryId}` }] : []),
                        { label: dashboardName || t('dashboard_header.breadcrumbs.dashboard') }
                    ]}
                    className="mb-4"
                />

                {/* Dashboard Header */}
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-xs font-medium text-text-muted">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </span>
                            <span>{t('dashboard_header.status.updated', { time: lastUpdated })}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-text-main tracking-tight">
                                {dashboardName || t('dashboard_header.status.loading')}
                            </h1>
                            {dataSourceName && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-brand/10 text-brand border border-brand/20 shadow-sm">
                                    <Settings className="w-3.5 h-3.5" />
                                    {dataSourceName}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {editMode && (
                            <button
                                onClick={onOpenLibrary}
                                className="flex items-center px-4 py-2 bg-text-main text-surface rounded-full text-sm font-semibold hover:opacity-90 transition-all shadow-lg"
                            >
                                <Plus className="w-4 h-4 me-2" />
                                {t('dashboard_header.actions.add_widget')}
                            </button>
                        )}
                        <button
                            onClick={onEditModeToggle}
                            disabled={isSaving}
                            className={`flex items-center justify-center min-w-[12rem] px-5 py-2 rounded-full text-sm font-bold transition-all ${editMode
                                ? 'bg-brand/10 text-brand ring-2 ring-inset ring-brand/20 shadow-inner'
                                : 'bg-surface text-text-main ring-1 ring-inset ring-border hover:shadow-sm'
                                } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                            ) : (
                                <LayoutGrid className="w-4 h-4 me-2" />
                            )}
                            {editMode ? (isSaving ? t('dashboard_header.status.saving') : t('dashboard_header.actions.save_layout')) : t('dashboard_header.actions.design_layout')}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;

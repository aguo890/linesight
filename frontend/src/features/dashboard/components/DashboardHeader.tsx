/**
 * DashboardHeader Component
 * 
 * Displays the dashboard title, live status indicator, data source badge,
 * and edit mode controls. Extracted from DynamicDashboardPage for modularity.
 */
import React from 'react';
import { LayoutGrid, Loader2, Settings, Plus, RefreshCw } from 'lucide-react';
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
    /** Optional: Global refresh handler */
    onRefresh?: () => void;
    /** Optional: Reset layout handler */
    onReset?: () => void;
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
    onRefresh,
    onReset,
}) => {

    return (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
            <div className="max-w-[1600px] mx-auto">
                {/* Breadcrumb Navigation */}
                <Breadcrumb
                    items={[
                        { label: 'Workspace', href: '/dashboard/factories' },
                        ...(factoryId ? [{ label: factoryName || 'Factory', href: `/dashboard/factories/${factoryId}` }] : []),
                        { label: dashboardName || 'Dashboard' }
                    ]}
                    className="mb-4"
                />

                {/* Dashboard Header */}
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-xs font-medium text-slate-400">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Updated {lastUpdated}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {dashboardName || 'Loading Dashboard...'}
                            </h1>
                            {dataSourceName && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                                    <Settings className="w-3.5 h-3.5" />
                                    {dataSourceName}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow"
                                title="Refresh all widgets"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </button>
                        )}
                        {onReset && (
                            <button
                                onClick={() => {
                                    if (confirm('Reset dashboard layout? This will clear all customizations and reload the page.')) {
                                        onReset();
                                    }
                                }}
                                className="flex items-center px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
                                title="Reset dashboard layout"
                            >
                                Reset Layout
                            </button>
                        )}
                        {editMode && (
                            <button
                                onClick={onOpenLibrary}
                                className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Widget
                            </button>
                        )}
                        <button
                            onClick={onEditModeToggle}
                            disabled={isSaving}
                            className={`flex items-center px-5 py-2 rounded-full text-sm font-bold transition-all ${editMode
                                ? 'bg-sky-50 text-sky-700 ring-2 ring-sky-500/20 shadow-inner'
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-sm'
                                } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <LayoutGrid className="w-4 h-4 mr-2" />
                            )}
                            {editMode ? (isSaving ? 'Saving...' : 'Exit Designer') : 'Design Layout'}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;

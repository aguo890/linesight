/**
 * My Dashboards Gallery Page
 * 
 * Command Center style dashboard for viewing production sites.
 * Pure Operations View - No configuration/management capabilities.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Search,
    LayoutGrid,
    List,
    ChevronRight,
    Factory as FactoryIcon,
    Building2,
    Settings,
    Plus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../components/layout/MainLayout';
import { FactoryCard } from '../components/FactoryCard';
import { useListFactoriesApiV1FactoriesGet } from '../../../api/endpoints/factories/factories';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { DashboardWizard } from '../components/DashboardWizard';

type ViewMode = 'grid' | 'list';

export const MyDashboardsPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Control Bar state
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // consume context
    const { quotaStatus } = useOrganization();
    const { isAdmin, canCreateDashboard, canManageInfrastructure } = usePermissions();

    // Modal state for New Dashboard wizard
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    // Use Orval hook for fetching factories
    const {
        data: factoriesData,
        isLoading: isLoadingFactories,
        error: factoryError
    } = useListFactoriesApiV1FactoriesGet();

    // Enrich factories with line counts from Context if available
    const factories = useMemo(() => {
        if (!factoriesData) return [];

        return factoriesData.map((factory: any) => {
            const quotaInfo = quotaStatus?.lines_per_factory.by_factory.find(
                q => q.factory_id === factory.id
            );

            const actualLineCount = factory.production_lines?.length ?? quotaInfo?.current ?? 0;

            return {
                ...factory,
                code: typeof factory.code === 'string' ? factory.code : undefined,
                lineCount: actualLineCount
            };
        });
    }, [factoriesData, quotaStatus]);

    // Filter factories based on search
    const filteredFactories = useMemo(() => {
        if (!searchQuery.trim()) return factories;

        const query = searchQuery.toLowerCase();
        return factories.filter(factory =>
            factory.name.toLowerCase().includes(query) ||
            (factory.code && factory.code.toLowerCase().includes(query))
        );
    }, [factories, searchQuery]);

    // Keyboard shortcut for search (Cmd/Ctrl + K)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('factory-search');
            searchInput?.focus();
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (factoryError) {
        console.error('Error loading factories:', factoryError);
    }

    return (
        <MainLayout>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-text-main">{t('dashboard.my_dashboards.title')}</h1>
                    <p className="text-sm text-text-muted mt-1">
                        {isLoadingFactories
                            ? t('dashboard.my_dashboards.status.loading')
                            : factories.length === 0
                                ? t('dashboard.my_dashboards.status.none')
                                : t('dashboard.my_dashboards.status.available', { count: factories.length })
                        }
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    {/* New Dashboard Button */}
                    {canCreateDashboard && (
                        <button
                            onClick={() => setIsWizardOpen(true)}
                            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            {t('dashboard.my_dashboards.actions.new_dashboard')}
                        </button>
                    )}

                    {/* Settings Link */}
                    {isAdmin && (
                        <Link
                            to="/organization/settings/factories"
                            className="flex items-center gap-2 text-text-main hover:text-brand bg-surface border border-border hover:border-brand-light px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            <Settings className="w-4 h-4" />
                            {t('dashboard.my_dashboards.actions.configure_sites')}
                        </Link>
                    )}
                </div>
            </div>

            {/* Control Bar - Search & View Toggles */}
            {factories.length > 0 && !isLoadingFactories && (
                <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-surface-subtle/80 backdrop-blur-sm py-3 -mx-4 px-4 rounded-lg">
                    {/* Search Input */}
                    <div className="relative group w-full max-w-sm">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                        <input
                            id="factory-search"
                            type="text"
                            placeholder={t('dashboard.my_dashboards.search_placeholder')}
                            className="w-full ps-10 pe-16 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm placeholder-text-muted"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-surface-subtle px-1.5 font-mono text-[10px] font-medium text-text-muted">
                                <span className="text-xs">Ctrl/⌘ +</span>K
                            </kbd>
                        </div>
                    </div>

                    {/* View Toggles */}
                    <div className="flex items-center p-1 bg-surface border border-border rounded-lg shadow-sm ms-4">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-surface-subtle text-brand shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                            title={t('dashboard.my_dashboards.view.grid')}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-surface-subtle text-brand shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                            title={t('dashboard.my_dashboards.view.list')}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Search Results Info */}
            {searchQuery && filteredFactories.length !== factories.length && (
                <p className="text-sm text-text-muted mb-4">
                    {t('dashboard.my_dashboards.search.results_info', { count: filteredFactories.length, total: factories.length })}
                </p>
            )}

            {/* Content Area - Grid View */}
            {viewMode === 'grid' && (isLoadingFactories || filteredFactories.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="factories-grid">

                    {/* Loading Skeletons - Using semantic neutrals */}
                    {isLoadingFactories ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse bg-surface rounded-xl border border-border p-5">
                                {/* Header: Icon + Name */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-surface-subtle rounded-lg" />
                                        <div className="space-y-2">
                                            <div className="h-4 bg-surface-subtle rounded w-32" />
                                            <div className="h-3 bg-surface-subtle rounded w-20" />
                                        </div>
                                    </div>
                                    <div className="w-2.5 h-2.5 bg-surface-subtle rounded-full" />
                                </div>

                                {/* Metric Row */}
                                <div className="flex items-end justify-between mt-6 pt-4 border-t border-border">
                                    <div>
                                        <div className="h-8 bg-surface-subtle rounded w-12 mb-1" />
                                        <div className="h-4 bg-surface-subtle rounded w-24" />
                                    </div>
                                    <div className="h-8 bg-surface-subtle rounded w-24" />
                                </div>

                                {/* Action Row */}
                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                                    <div className="h-8 bg-surface-subtle rounded w-16" />
                                    <div className="h-8 bg-surface-subtle rounded w-16" />
                                    <div className="ml-auto h-4 bg-surface-subtle rounded w-12" />
                                </div>
                            </div>
                        ))
                    ) : (
                        // Actual Factory Cards
                        filteredFactories.map(factory => (
                            <FactoryCard
                                key={factory.id}
                                factory={{
                                    id: factory.id,
                                    name: factory.name,
                                    code: factory.code,
                                    lineCount: factory.lineCount || 0,
                                    maxLines: quotaStatus?.lines_per_factory.max || 10
                                }}
                                onClick={(id) => navigate(`/dashboard/factories/${id}`)}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Content Area - List View */}
            {viewMode === 'list' && !isLoadingFactories && filteredFactories.length > 0 && (
                <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm" data-testid="factories-list">
                    <table className="w-full text-start border-collapse">
                        <thead className="bg-surface-subtle border-b border-border">
                            <tr>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">{t('dashboard.my_dashboards.table.header_name')}</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">{t('dashboard.my_dashboards.table.header_location')}</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">{t('dashboard.my_dashboards.table.header_lines')}</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">{t('dashboard.my_dashboards.table.header_status')}</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-end">{t('dashboard.my_dashboards.table.header_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredFactories.map(factory => {
                                const lineCount = factory.lineCount || 0;
                                const maxLines = quotaStatus?.lines_per_factory.max || 10;
                                const quotaPercentage = (lineCount / maxLines) * 100;

                                // Note: Status colors (red, amber, emerald) usually stay hardcoded or use functional semantic names
                                const getStatusStyle = () => {
                                    if (quotaPercentage >= 100) return 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/20';
                                    if (quotaPercentage >= 80) return 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/20';
                                    return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/20';
                                };

                                const getStatusText = () => {
                                    if (quotaPercentage >= 100) return t('dashboard.my_dashboards.factory_status.at_limit');
                                    if (quotaPercentage >= 80) return t('dashboard.my_dashboards.factory_status.near_limit');
                                    return t('dashboard.my_dashboards.factory_status.active');
                                };

                                return (
                                    <tr
                                        key={factory.id}
                                        className="transition-colors group hover:bg-surface-subtle cursor-pointer"
                                        onClick={() => navigate(`/dashboard/factories/${factory.id}`)}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center border border-brand/20">
                                                    <FactoryIcon className="w-4 h-4 text-brand" />
                                                </div>
                                                <span className="font-medium text-text-main group-hover:text-brand transition-colors">
                                                    {factory.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-text-muted font-mono text-sm">
                                            {factory.code || '—'}
                                        </td>
                                        <td className="py-3 px-4 text-text-main">
                                            {lineCount} / {maxLines}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusStyle()}`}>
                                                {getStatusText()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-end">
                                            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-main inline-block" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* No Results State */}
            {!isLoadingFactories && searchQuery && filteredFactories.length === 0 && factories.length > 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="w-12 h-12 text-text-muted mb-4" />
                    <h3 className="text-lg font-semibold text-text-main mb-1">{t('dashboard.my_dashboards.search.no_results')}</h3>
                    <p className="text-sm text-text-muted">
                        {t('dashboard.my_dashboards.search.no_results_detail', { query: searchQuery })}
                    </p>
                    <button
                        onClick={() => setSearchQuery('')}
                        className="mt-4 text-sm text-brand hover:text-brand-dark font-medium"
                    >
                        {t('dashboard.my_dashboards.actions.clear_search')}
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!isLoadingFactories && factories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-6 bg-gradient-to-b from-surface to-surface-subtle rounded-2xl border border-border shadow-sm">
                    {/* Animated Icon */}
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-brand/20 rounded-full blur-3xl opacity-40 animate-pulse scale-150" />
                        <div className="relative bg-surface p-6 rounded-2xl shadow-xl border border-border group">
                            <Building2 className="w-14 h-14 text-brand" strokeWidth={1.5} />
                        </div>
                    </div>

                    {/* Copy */}
                    <h2 className="text-2xl font-bold text-text-main mb-2">{t('dashboard.my_dashboards.empty_state.title')}</h2>
                    <p className="text-text-muted mb-8 text-center max-w-md">
                        {t('dashboard.my_dashboards.empty_state.description')}
                        {" "}
                        {canManageInfrastructure
                            ? t('dashboard.my_dashboards.empty_state.admin_hint')
                            : t('dashboard.my_dashboards.empty_state.user_hint')}
                    </p>

                    {/* CTA Button */}
                    {canManageInfrastructure && (
                        <Link
                            to="/organization/settings/factories"
                            className="group flex items-center gap-3 bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-brand/20 transition-all active:scale-[0.98]"
                        >
                            <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                            {t('dashboard.my_dashboards.empty_state.cta')}
                        </Link>
                    )}
                </div>
            )}

            {/* Dashboard Creation Wizard Modal */}
            <DashboardWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onComplete={(dashboardId) => {
                    setIsWizardOpen(false);
                    navigate(`/dashboard/${dashboardId}`);
                }}
                mode="create"
            />
        </MainLayout>
    );
};

export default MyDashboardsPage;
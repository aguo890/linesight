/**
 * Factory Detail Page
 * 
 * Command Center view for a specific Production Site.
 * Features:
 * - High-level metrics overview
 * - Dashboard management with ghost-card creation
 * - Data Source management with Grid/List views
 * - Search filtering for resources
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Factory as FactoryIcon,
    Plus,
    Settings,
    MapPin,
    Globe,
    List,
    LayoutGrid,
    Search,
    TrendingUp,
    Activity,
    MonitorPlay,
    Grid3x3,
    ChevronRight,
    Database
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataSourceCard } from '@/components/DataSourceCard';
import { CreateDataSourceModal } from '../../organization/components/CreateDataSourceModal';
import { DataSourceUploadModal } from '@/components/DataSourceUploadModal';
import { MappingFlowModal } from '@/components/MappingFlowModal';
import { DashboardWizard } from '@/components/DashboardWizard';

import { Skeleton } from '@/components/ui/Skeleton';
import { DashboardCard } from '@/components/DashboardCard';
import { FactorySettingsModal } from '@/components/FactorySettingsModal';
import { dashboardStorage } from '../storage';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useFactory } from '@/hooks/useFactory';
import {
    useListDashboardsApiV1DashboardsGet,
    useDeleteDashboardApiV1DashboardsDashboardIdDelete
} from '../../../api/endpoints/dashboards/dashboards';
import type { Dashboard } from '../types';
import type { DataSource } from '@/lib/factoryApi';
import { usePermissions } from '@/hooks/usePermissions';

type ViewMode = 'grid' | 'list';

const DashboardCardSkeleton = () => (
    <div className="bg-surface rounded-xl border border-border p-5 h-full">
        <div className="flex justify-between items-start mb-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-3/4 mb-1" />
        <div className="space-y-2 mt-4">
            <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4 rounded" />
        </div>
    </div>
);

const DataSourceCardSkeleton = () => (
    <div className="bg-surface rounded-xl border border-border overflow-hidden h-full">
        <div className="h-1.5 w-full bg-surface-subtle" />
        <div className="p-5">
            <div className="flex items-start justify-between mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="mb-4">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-9 w-full rounded-md mb-4" />
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
        </div>
    </div>
);

export const FactoryDetailPage: React.FC = () => {
    const { factoryId } = useParams<{ factoryId: string }>();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const numberFormatter = useMemo(() => {
        return new Intl.NumberFormat(i18n.language);
    }, [i18n.language]);

    const formatNumber = (val: number) => numberFormatter.format(val);

    // Context
    const { quotaStatus } = useOrganization();
    const { canManageInfrastructure, canUploadToLine, canUploadAny } = usePermissions();

    // UI State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Logic State
    const [currentRawImportId, setCurrentRawImportId] = useState<string | null>(null);
    const [mappingLineId, setMappingLineId] = useState<string | null>(null);
    const [selectedDataSourceForUpload, setSelectedDataSourceForUpload] = useState<DataSource | null>(null);

    // Filter & View State
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceViewMode, setSourceViewMode] = useState<ViewMode>('grid');

    // --- Data Fetching ---

    // Using the unified hook
    const {
        factory,
        dataSources,
        isLoading: factoryLoading,
        refresh: refreshFactoryData
    } = useFactory(factoryId);

    const { data: dashboardsResponse, refetch: refetchDashboards } = useListDashboardsApiV1DashboardsGet(
        { factory_id: factoryId },
        { query: { enabled: !!factoryId } }
    );

    const deleteDashboardMutation = useDeleteDashboardApiV1DashboardsDashboardIdDelete();

    // --- Transformations & Memoization ---

    const dashboards = useMemo(() => (dashboardsResponse?.dashboards || []) as unknown as Dashboard[], [dashboardsResponse]);
    // const isLoading = factoryLoading || dashboardsLoading;

    // Filtered Lists
    const filteredDashboards = useMemo(() => {
        if (!dashboardSearch) return dashboards;
        const q = dashboardSearch.toLowerCase();
        return dashboards.filter((d: Dashboard) =>
            d.name.toLowerCase().includes(q)
        );
    }, [dashboards, dashboardSearch]);

    const filteredDataSources = useMemo(() => {
        if (!sourceSearch) return dataSources;
        const q = sourceSearch.toLowerCase();
        return dataSources.filter(ds =>
            ds.name.toLowerCase().includes(q) ||
            (ds.code && ds.code.toLowerCase().includes(q))
        );
    }, [dataSources, sourceSearch]);

    // --- Actions ---

    const loadAllData = async () => {
        await refreshFactoryData();
        await refetchDashboards();
    };

    const handleCreateSource = () => setIsCreateModalOpen(true);
    const handleCreateDashboard = () => setIsWizardOpen(true);

    const handleSourceCreationSuccess = () => {
        if (factoryId) loadAllData();
    };

    const handleEditSource = () => {
        alert(t('factory_detail.alerts.edit_soon'));
    };

    const handleDeleteSource = (_sourceId: string) => {
        if (confirm(t('factory_detail.confirm.delete_source'))) {
            alert(t('factory_detail.alerts.delete_soon'));
        }
    };

    const handleUploadSource = (sourceId: string) => {
        const source = dataSources.find(s => s.id === sourceId);
        if (source) {
            setSelectedDataSourceForUpload(source);
            setIsUploadModalOpen(true);
        }
    };

    const handleUploadSuccess = (data: any) => {
        if (data && data.raw_import_id) {
            setCurrentRawImportId(data.raw_import_id);
            setMappingLineId(selectedDataSourceForUpload?.id || null);
            setIsUploadModalOpen(false);
            setIsMappingModalOpen(true);
        } else {
            if (factoryId) loadAllData();
        }
    };

    const handleMappingSuccess = () => {
        setIsMappingModalOpen(false);
        setCurrentRawImportId(null);
        setMappingLineId(null);
        if (factoryId) loadAllData();
    };

    const handleWizardComplete = async (dashboardId: string) => {
        setIsWizardOpen(false);
        if (factoryId) await loadAllData();
        navigate(`/dashboard/factories/${factoryId}/dashboards/${dashboardId}`);
    };

    const handleOpenDashboard = (dashboardId: string) => {
        dashboardStorage.setActiveId(dashboardId);
        navigate(`/dashboard/factories/${factoryId}/dashboards/${dashboardId}`);
    };

    const handleDeleteDashboard = async (dashboardId: string) => {
        if (confirm(t('factory_detail.confirm.delete_dashboard'))) {
            try {
                await deleteDashboardMutation.mutateAsync({ dashboardId });
                dashboardStorage.deleteDashboard(dashboardId);
                if (factoryId) loadAllData();
            } catch (error) {
                console.error('Failed to delete dashboard:', error);
                alert(t('factory_detail.alerts.delete_fail'));
            }
        }
    };

    // Calculate Stats
    const stats = {
        totalDashboards: dashboards.length,
        totalWidgets: dashboards.reduce((acc: number, d: Dashboard) => {
            const layout = d.layout_config ? JSON.parse(d.layout_config) : { layouts: [] };
            return acc + (layout.layouts?.length || 0);
        }, 0),
        avgWidgets: 0
    };
    stats.avgWidgets = stats.totalDashboards ? Math.round(stats.totalWidgets / stats.totalDashboards) : 0;

    // TODO: Update quota logic for Data Sources
    // Assuming "lines_per_factory" quota applies to "data_sources_per_factory" for now
    const factoryQuota = quotaStatus?.lines_per_factory.by_factory.find(f => f.factory_id === factory?.id);
    const canCreateSource = factoryQuota?.can_create ?? true;

    // --- Render ---

    // 1. Initial Page Load (Factory details missing)
    if (factoryLoading) {
        // Reuse skeleton structure

        return (
            <MainLayout>
                <div className="mb-8">
                    <Skeleton className="h-4 w-48 mb-4" />
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 bg-surface rounded-xl border border-border shadow-sm flex items-center justify-center">
                                <Skeleton className="w-7 h-7 rounded" />
                            </div>
                            <div>
                                <Skeleton className="h-8 w-64 mb-2" />
                                <div className="flex gap-4">
                                    <Skeleton className="h-5 w-20 rounded" />
                                    <Skeleton className="h-5 w-32" />
                                </div>
                            </div>
                        </div>
                        <Skeleton className="h-10 w-28 rounded-lg" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-surface p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
                            <div>
                                <Skeleton className="h-3 w-24 mb-2" />
                                <Skeleton className="h-8 w-12" />
                            </div>
                            <Skeleton className="h-11 w-11 rounded-lg" />
                        </div>
                    ))}
                </div>
                <div className="space-y-12">
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-full" />
                                <Skeleton className="h-6 w-32" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            <DashboardCardSkeleton />
                            <DashboardCardSkeleton />
                        </div>
                    </section>
                    <div className="h-px bg-border w-full" />
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-full" />
                                <Skeleton className="h-6 w-40" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            <DataSourceCardSkeleton />
                            <DataSourceCardSkeleton />
                            <DataSourceCardSkeleton />
                        </div>
                    </section>
                </div>
            </MainLayout>
        );
    }

    if (!factory) {
        return (
            <MainLayout>
                <div className="text-center py-12">
                    <h2 className="text-xl font-bold text-text-main">{t('factory_detail.not_found')}</h2>
                    <Breadcrumb items={[{ label: t('factory_detail.breadcrumbs.list'), href: '/dashboard/factories' }, { label: t('factory_detail.breadcrumbs.not_found') }]} className="mt-4 justify-center" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            {/* Header */}
            <div className="mb-8">
                <Breadcrumb
                    items={[
                        { label: t('factory_detail.breadcrumbs.list'), href: '/dashboard/factories' },
                        { label: factory.name }
                    ]}
                    className="mb-4"
                />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-surface rounded-xl border border-border shadow-sm flex items-center justify-center">
                            <FactoryIcon className="w-7 h-7 text-brand" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-text-main">{factory.name}</h1>
                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-1.5 text-sm text-text-muted">
                                {factory.code && (
                                    <span className="flex items-center gap-1.5 font-mono bg-surface-subtle px-2 py-0.5 rounded text-text-muted text-xs border border-border">
                                        {factory.code}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-text-muted" />
                                    {factory.city ? `${factory.city}, ${factory.country}` : factory.country || 'Unknown Location'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-text-muted" />
                                    {factory.organization_id}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-muted bg-surface border border-border rounded-lg hover:bg-surface-subtle hover:text-text-main transition-colors shadow-sm"
                    >
                        <Settings className="w-4 h-4" />
                        {t('factory_detail.actions.settings')}
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm flex items-center justify-between group hover:border-brand/40 transition-colors">
                    <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">{t('factory_detail.stats.dashboards')}</p>
                        <h3 className="text-2xl font-bold text-text-main mt-1">{formatNumber(stats.totalDashboards)}</h3>
                    </div>
                    <div className="p-3 bg-brand/10 rounded-lg group-hover:bg-brand/20 transition-colors">
                        <LayoutGrid className="w-5 h-5 text-brand" />
                    </div>
                </div>
                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm flex items-center justify-between group hover:border-accent-purple/40 transition-colors">
                    <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">{t('factory_detail.stats.active_widgets')}</p>
                        <h3 className="text-2xl font-bold text-text-main mt-1">{formatNumber(stats.totalWidgets)}</h3>
                    </div>
                    <div className="p-3 bg-accent-purple/10 rounded-lg group-hover:bg-accent-purple/20 transition-colors">
                        <Grid3x3 className="w-5 h-5 text-accent-purple" />
                    </div>
                </div>
                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm flex items-center justify-between group hover:border-success/40 transition-colors">
                    <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">{t('factory_detail.stats.active_sources')}</p>
                        {/* Counting data sources instead of complexity for now */}
                        <h3 className="text-2xl font-bold text-text-main mt-1">{dataSources.length}</h3>
                    </div>
                    <div className="p-3 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors">
                        <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {/* ---------------- Dashboards Section ---------------- */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <MonitorPlay className="w-5 h-5 text-text-muted" />
                            <h2 className="text-lg font-bold text-text-main">{t('factory_detail.sections.dashboards')}</h2>
                            <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-text-muted text-xs font-medium border border-border">
                                {dashboards.length}
                            </span>
                        </div>
                    </div>

                    {/* Control Bar - Dashboards */}
                    <div className="flex items-center gap-3 mb-6 p-1">
                        <div className="relative flex-1 max-w-sm group">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                            <input
                                type="text"
                                placeholder={t('factory_detail.search.dashboards_placeholder')}
                                value={dashboardSearch}
                                onChange={(e) => setDashboardSearch(e.target.value)}
                                className="w-full ps-9 pe-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex-1"></div>
                        {dashboards.length > 0 && (
                            <button
                                onClick={handleCreateDashboard}
                                className="hidden sm:flex items-center gap-2 bg-surface hover:bg-surface-subtle text-text-main border border-border px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                {t('factory_detail.actions.new_dashboard')}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Ghost Card for New Dashboard */}
                        <button
                            onClick={handleCreateDashboard}
                            className="group flex flex-col items-center justify-center min-h-[160px] rounded-xl border border-dashed border-border bg-surface-subtle/50 hover:bg-surface hover:border-brand hover:shadow-md transition-all duration-200"
                        >
                            <div className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center mb-3 group-hover:scale-110 group-hover:border-brand/40 group-hover:shadow-sm transition-all duration-200">
                                <Plus className="w-5 h-5 text-text-muted group-hover:text-brand transition-colors" />
                            </div>
                            <span className="font-medium text-text-muted group-hover:text-brand transition-colors">{t('factory_detail.actions.create_dashboard')}</span>
                        </button>

                        {/* Dashboard Cards */}
                        {filteredDashboards.map((dashboard: Dashboard) => (
                            <DashboardCard
                                key={dashboard.id}
                                dashboard={dashboard}
                                onClick={handleOpenDashboard}
                                onDelete={handleDeleteDashboard}
                            />
                        ))}
                    </div>
                </section>

                <div className="h-px bg-border w-full" />

                {/* ---------------- Data Sources Section ---------------- */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-text-muted" />
                            <h2 className="text-lg font-bold text-text-main">{t('factory_detail.sections.data_sources')}</h2>
                            {factoryQuota && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${factoryQuota.current >= (quotaStatus?.lines_per_factory.max || 0)
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : 'bg-success/10 text-success border-success/20'
                                    }`}>
                                    {t('factory_detail.stats.used_info', { current: formatNumber(factoryQuota.current), max: formatNumber(quotaStatus?.lines_per_factory.max || 0) })}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Control Bar - Data Sources */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 top-0 z-10 bg-surface-subtle/90 backdrop-blur-sm py-1 rounded-lg">
                        <div className="relative w-full sm:max-w-xs group">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                            <input
                                type="text"
                                placeholder={t('factory_detail.search.sources_placeholder')}
                                value={sourceSearch}
                                onChange={(e) => setSourceSearch(e.target.value)}
                                className="w-full ps-9 pe-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <div className="flex items-center p-1 bg-surface border border-border rounded-lg shadow-sm">
                                <button
                                    onClick={() => setSourceViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-all ${sourceViewMode === 'grid' ? 'bg-brand/10 text-brand shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setSourceViewMode('list')}
                                    className={`p-1.5 rounded-md transition-all ${sourceViewMode === 'list' ? 'bg-brand/10 text-brand shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>

                            {/* New Source Button - Only for users who can manage infrastructure */}
                            {canManageInfrastructure && (
                                <button
                                    onClick={handleCreateSource}
                                    disabled={!canCreateSource}
                                    className="flex items-center gap-2 bg-brand hover:bg-brand-dark disabled:bg-surface-subtle disabled:text-text-muted disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4" />
                                    {t('factory_detail.actions.new_source')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Content - Grid View */}
                    {sourceViewMode === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {/* Ghost Card for New Source */}
                            {canManageInfrastructure && (
                                <button
                                    onClick={handleCreateSource}
                                    disabled={!canCreateSource}
                                    className="group flex flex-col items-center justify-center min-h-[180px] rounded-xl border border-dashed border-border bg-surface-subtle/50 hover:bg-surface hover:border-brand hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="h-12 w-12 rounded-full bg-surface border border-border flex items-center justify-center mb-3 group-hover:scale-110 group-hover:border-brand/40 group-hover:shadow-sm transition-all duration-200">
                                        <Plus className="w-6 h-6 text-text-muted group-hover:text-brand transition-colors" />
                                    </div>
                                    <span className="font-medium text-text-muted group-hover:text-brand transition-colors">{t('factory_detail.actions.add_data_source')}</span>
                                    {!canCreateSource && <span className="text-xs text-error mt-1">{t('factory_detail.quota.limit_reached')}</span>}
                                </button>
                            )}

                            {filteredDataSources.map((source) => (
                                <DataSourceCard
                                    key={source.id}
                                    dataSource={source}
                                    onEdit={handleEditSource}
                                    onDelete={handleDeleteSource}
                                    onUpload={handleUploadSource}
                                    onClick={(sourceId) => navigate(`/dashboard/factories/${factoryId}/lines/${sourceId}`)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Content - List View */}
                    {sourceViewMode === 'list' && (
                        <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
                            <table className="w-full text-start border-collapse">
                                <thead className="bg-surface-subtle border-b border-border">
                                    <tr>
                                        <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">{t('factory_detail.table.headers.name')}</th>
                                        <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">{t('factory_detail.table.headers.status')}</th>
                                        <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-end">{t('factory_detail.table.headers.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredDataSources.map(source => (
                                        <tr
                                            key={source.id}
                                            onClick={() => navigate(`/dashboard/factories/${factoryId}/lines/${source.id}`)}
                                            className="hover:bg-surface-subtle transition-colors cursor-pointer group"
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-surface-subtle rounded-lg text-text-muted">
                                                        <Database className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-medium text-text-main group-hover:text-brand transition-colors">{source.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${source.is_active
                                                    ? 'bg-success/10 text-success border-success/20'
                                                    : 'bg-surface-subtle text-text-muted border-border'
                                                    }`}>
                                                    {source.is_active ? t('factory_detail.status.active') : t('factory_detail.status.inactive')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-end">
                                                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                    {/* Upload button - permission aware */}
                                                    {canUploadAny && (
                                                        <button
                                                            onClick={() => canUploadToLine(source.id) && handleUploadSource(source.id)}
                                                            disabled={!canUploadToLine(source.id)}
                                                            className={`p-1.5 rounded ${canUploadToLine(source.id)
                                                                ? 'text-text-muted hover:text-brand hover:bg-brand/10'
                                                                : 'text-text-muted/50 cursor-not-allowed'
                                                                }`}
                                                            title={canUploadToLine(source.id) ? t('factory_detail.actions.upload_data') : t('factory_detail.actions.no_write_access')}
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <ChevronRight className="w-4 h-4 text-text-muted/50 ms-2 rtl:rotate-180" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredDataSources.length === 0 && (
                                <div className="p-8 text-center text-text-muted">
                                    {t('factory_detail.search.no_sources_found')}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {/* Modals */}
            <DashboardWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onComplete={handleWizardComplete}
                preselectedFactoryId={factory?.id}
            />
            <CreateDataSourceModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleSourceCreationSuccess}
                factoryId={factory.id}
                factoryName={factory.name}
                quotaStatus={quotaStatus}
            />
            {selectedDataSourceForUpload && (
                <DataSourceUploadModal
                    isOpen={isUploadModalOpen}
                    onClose={() => {
                        setIsUploadModalOpen(false);
                        setSelectedDataSourceForUpload(null);
                    }}
                    onSuccess={handleUploadSuccess}
                    dataSourceId={selectedDataSourceForUpload.id}
                    dataSourceName={selectedDataSourceForUpload.name}
                    factoryId={factory.id}
                />
            )}
            <MappingFlowModal
                isOpen={isMappingModalOpen}
                onClose={() => setIsMappingModalOpen(false)}
                rawImportId={currentRawImportId}
                dataSourceId={mappingLineId}
                onSuccess={handleMappingSuccess}
            />
            {factory && (
                <FactorySettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    factory={factory}
                />
            )}
        </MainLayout>
    );
};

export default FactoryDetailPage;
/**
 * Factory Detail Page
 * 
 * Command Center view for a specific Production Site.
 * Features:
 * - High-level metrics overview
 * - Dashboard management with ghost-card creation
 * - Production Line management with Grid/List views
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
    Calendar,
    Trash2
} from 'lucide-react';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';
import { MainLayout } from '../../../components/layout/MainLayout';
import { ProductionLineCard } from '../components/ProductionLineCard';
import { CreateLineModal } from '../components/CreateLineModal';
import { LineUploadModal } from '../components/LineUploadModal';
import { MappingFlowModal } from '../components/MappingFlowModal';
import { DashboardWizard } from '../components/DashboardWizard';
import { CardsSkeleton } from '../components/CardsSkeleton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { DashboardCard } from '../components/DashboardCard';
import { FactorySettingsModal } from '../components/FactorySettingsModal';
import { dashboardStorage } from '../storage';

import { useOrganization } from '../../../contexts/OrganizationContext';
import {
    useGetFactoryApiV1FactoriesFactoryIdGet,
    useListProductionLinesApiV1FactoriesFactoryIdLinesGet
} from '../../../api/endpoints/factories/factories';
import {
    useListDashboardsApiV1DashboardsGet,
    useDeleteDashboardApiV1DashboardsDashboardIdDelete
} from '../../../api/endpoints/dashboards/dashboards';
import type { ProductionLineRead } from '../../../api/model';
import type { Dashboard } from '../types';

type ViewMode = 'grid' | 'list';

export const FactoryDetailPage: React.FC = () => {
    const { factoryId } = useParams<{ factoryId: string }>();
    const navigate = useNavigate();

    // Context
    const { quotaStatus } = useOrganization();

    // UI State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Logic State
    const [currentRawImportId, setCurrentRawImportId] = useState<string | null>(null);
    const [mappingLineId, setMappingLineId] = useState<string | null>(null);
    const [selectedLineForUpload, setSelectedLineForUpload] = useState<ProductionLineRead | null>(null);

    // Filter & View State
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [lineSearch, setLineSearch] = useState('');
    const [lineViewMode, setLineViewMode] = useState<ViewMode>('grid');

    // --- Data Fetching ---

    const { data: factory, isLoading: factoryLoading, refetch: refetchFactory } = useGetFactoryApiV1FactoriesFactoryIdGet(
        factoryId!,
        { query: { enabled: !!factoryId } }
    );

    const { data: linesData, isLoading: linesLoading, refetch: refetchLines } = useListProductionLinesApiV1FactoriesFactoryIdLinesGet(
        factoryId!,
        { query: { enabled: !!factoryId } }
    );

    const { data: dashboardsResponse, isLoading: dashboardsLoading, refetch: refetchDashboards } = useListDashboardsApiV1DashboardsGet(
        { factory_id: factoryId },
        { query: { enabled: !!factoryId } }
    );

    const deleteDashboardMutation = useDeleteDashboardApiV1DashboardsDashboardIdDelete();

    // --- Transformations & Memoization ---

    const dashboards = useMemo(() => (dashboardsResponse?.dashboards || []) as unknown as Dashboard[], [dashboardsResponse]);
    const lines = useMemo(() => linesData || [], [linesData]);
    // const isLoading = factoryLoading || linesLoading || dashboardsLoading; // Removed unused variable

    // Filtered Lists
    const filteredDashboards = useMemo(() => {
        if (!dashboardSearch) return dashboards;
        const q = dashboardSearch.toLowerCase();
        return dashboards.filter((d: Dashboard) =>
            d.name.toLowerCase().includes(q)
        );
    }, [dashboards, dashboardSearch]);

    const filteredLines = useMemo(() => {
        if (!lineSearch) return lines;
        const q = lineSearch.toLowerCase();
        return lines.filter(l =>
            l.name.toLowerCase().includes(q)
        );
    }, [lines, lineSearch]);

    // --- Actions ---

    const loadFactoryData = () => {
        refetchFactory();
        refetchLines();
        refetchDashboards();
    };

    const handleCreateLine = () => setIsCreateModalOpen(true);
    const handleCreateDashboard = () => setIsWizardOpen(true);

    const handleLineCreationSuccess = () => {
        if (factoryId) loadFactoryData();
    };

    const handleEditLine = (lineId: string) => {
        console.log('Edit line:', lineId);
        alert('Edit functionality coming soon');
    };

    const handleDeleteLine = (lineId: string) => {
        if (confirm('Are you sure you want to delete this line?')) {
            alert('Delete functionality coming soon');
        }
    };

    const handleUploadLine = (lineId: string) => {
        const line = lines.find(l => l.id === lineId);
        if (line) {
            setSelectedLineForUpload(line);
            setIsUploadModalOpen(true);
        }
    };

    const handleUploadSuccess = (data: any) => {
        if (data && data.raw_import_id) {
            setCurrentRawImportId(data.raw_import_id);
            setMappingLineId(selectedLineForUpload?.id || null);
            setIsUploadModalOpen(false);
            setIsMappingModalOpen(true);
        } else {
            if (factoryId) loadFactoryData();
        }
    };

    const handleMappingSuccess = () => {
        setIsMappingModalOpen(false);
        setCurrentRawImportId(null);
        setMappingLineId(null);
        if (factoryId) loadFactoryData();
    };

    const handleWizardComplete = async (dashboardId: string) => {
        setIsWizardOpen(false);
        if (factoryId) await loadFactoryData();
        navigate(`/dashboard/factories/${factoryId}/dashboards/${dashboardId}`);
    };

    const handleOpenDashboard = (dashboardId: string) => {
        dashboardStorage.setActiveId(dashboardId);
        navigate(`/dashboard/factories/${factoryId}/dashboards/${dashboardId}`);
    };

    const handleDeleteDashboard = async (dashboardId: string) => {
        if (confirm('Are you sure you want to delete this dashboard?')) {
            try {
                await deleteDashboardMutation.mutateAsync({ dashboardId });
                dashboardStorage.deleteDashboard(dashboardId);
                if (factoryId) loadFactoryData();
            } catch (error) {
                console.error('Failed to delete dashboard:', error);
                alert('Failed to delete dashboard.');
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

    const factoryQuota = quotaStatus?.lines_per_factory.by_factory.find(f => f.factory_id === factory?.id);
    const canCreateLine = factoryQuota?.can_create ?? true;

    // --- Render ---

    // 1. Initial Page Load (Factory details missing)
    if (factoryLoading) {
        // Helper: Exact Replica of DashboardCard Skeleton
        const DashboardCardSkeleton = () => (
            <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
                <div className="flex justify-between items-start mb-4">
                    <Skeleton className="h-9 w-9 rounded-lg" /> {/* Icon Box */}
                    {/* Trash icon is hidden by default, so we don't skeleton it to keep UI clean */}
                </div>

                <Skeleton className="h-6 w-3/4 mb-1" /> {/* Title */}

                <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-3.5 w-3.5 rounded-full" />
                        <Skeleton className="h-3 w-16" /> {/* Widget count */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-3.5 w-3.5 rounded-full" />
                        <Skeleton className="h-3 w-24" /> {/* Date */}
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Skeleton className="h-4 w-32" /> {/* Data Source Name */}
                    <Skeleton className="h-4 w-4 rounded" /> {/* Chevron */}
                </div>
            </div>
        );

        // Helper: Exact Replica of ProductionLineCard Skeleton
        const ProductionLineCardSkeleton = () => (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full">
                {/* Top Border Replica */}
                <div className="h-1.5 w-full bg-slate-100" />

                <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                        <Skeleton className="h-10 w-10 rounded-lg" /> {/* Settings Icon */}
                        <Skeleton className="h-6 w-16 rounded-full" /> {/* Status Badge */}
                    </div>

                    <div className="mb-4">
                        <Skeleton className="h-6 w-48 mb-2" /> {/* Line Name */}
                        <Skeleton className="h-4 w-20" />    {/* Code */}
                    </div>

                    {/* Specialty Box Skeleton */}
                    <Skeleton className="h-9 w-full rounded-md mb-4" />

                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                        <Skeleton className="h-8 w-8 rounded-lg" /> {/* Upload Btn */}
                        <Skeleton className="h-8 w-8 rounded-lg" /> {/* Edit Btn */}
                        <Skeleton className="h-8 w-8 rounded-lg" /> {/* Delete Btn */}
                    </div>
                </div>
            </div>
        );

        return (
            <MainLayout>
                {/* Header Section */}
                <div className="mb-8">
                    <Skeleton className="h-4 w-48 mb-4" /> {/* Breadcrumb */}

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {/* Factory Icon Box */}
                            <div className="h-14 w-14 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                                <Skeleton className="w-7 h-7 rounded" />
                            </div>
                            <div>
                                <Skeleton className="h-8 w-64 mb-2" /> {/* Factory Name */}
                                <div className="flex gap-4">
                                    <Skeleton className="h-5 w-20 rounded" /> {/* Code Tag */}
                                    <Skeleton className="h-5 w-32" /> {/* Location */}
                                </div>
                            </div>
                        </div>
                        <Skeleton className="h-10 w-28 rounded-lg" /> {/* Settings Button */}
                    </div>
                </div>

                {/* Quick Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                            <div>
                                <Skeleton className="h-3 w-24 mb-2" /> {/* Label */}
                                <Skeleton className="h-8 w-12" />      {/* Number */}
                            </div>
                            <Skeleton className="h-11 w-11 rounded-lg" /> {/* Icon Box */}
                        </div>
                    ))}
                </div>

                <div className="space-y-12">
                    {/* ---------------- Dashboards Section ---------------- */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-full" />
                                <Skeleton className="h-6 w-32" />
                            </div>
                        </div>

                        {/* Dashboard Control Bar */}
                        <div className="flex items-center gap-3 mb-6 p-1">
                            <Skeleton className="h-10 w-full max-w-sm rounded-lg" /> {/* Search Input */}
                            <div className="flex-1"></div>
                            <Skeleton className="hidden sm:block h-10 w-36 rounded-lg" /> {/* New Dash Button */}
                        </div>

                        {/* Dashboard Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {/* Ghost Card Skeleton */}
                            <div className="min-h-[160px] rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center">
                                <Skeleton className="h-10 w-10 rounded-full mb-3" />
                                <Skeleton className="h-5 w-36" />
                            </div>
                            {/* Detailed Card Skeletons */}
                            <DashboardCardSkeleton />
                            <DashboardCardSkeleton />
                        </div>
                    </section>

                    <div className="h-px bg-slate-200 w-full" />

                    {/* ---------------- Production Lines Section ---------------- */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-full" />
                                <Skeleton className="h-6 w-40" />
                            </div>
                        </div>

                        {/* Production Line Control Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 py-2">
                            <Skeleton className="h-10 w-full sm:max-w-xs rounded-lg" /> {/* Search */}

                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                <div className="flex items-center p-1 bg-white border border-slate-200 rounded-lg shadow-sm h-9 w-16">
                                    {/* Toggle placeholder */}
                                </div>
                                <Skeleton className="h-10 w-28 rounded-lg" /> {/* New Line Button */}
                            </div>
                        </div>

                        {/* Production Line Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {/* Ghost Card Skeleton */}
                            <div className="min-h-[180px] rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center">
                                <Skeleton className="h-12 w-12 rounded-full mb-3" />
                                <Skeleton className="h-5 w-40" />
                            </div>
                            {/* Detailed Card Skeletons */}
                            <ProductionLineCardSkeleton />
                            <ProductionLineCardSkeleton />
                            <ProductionLineCardSkeleton />
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
                    <h2 className="text-xl font-bold text-slate-900">Factory not found</h2>
                    <Breadcrumb items={[{ label: 'Sites', href: '/dashboard/factories' }, { label: 'Not Found' }]} className="mt-4 justify-center" />
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
                        { label: 'Production Sites', href: '/dashboard/factories' },
                        { label: factory.name }
                    ]}
                    className="mb-4"
                />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                            <FactoryIcon className="w-7 h-7 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{factory.name}</h1>
                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-1.5 text-sm text-slate-500">
                                {factory.code && (
                                    <span className="flex items-center gap-1.5 font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 text-xs border border-slate-200">
                                        {factory.code}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                    {factory.city ? `${factory.city}, ${factory.country}` : factory.country || 'Unknown Location'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                                    {factory.organization_id}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dashboards</p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalDashboards}</h3>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                        <LayoutGrid className="w-5 h-5 text-indigo-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-purple-200 transition-colors">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Widgets</p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalWidgets}</h3>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                        <Grid3x3 className="w-5 h-5 text-purple-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-colors">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Complexity</p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.avgWidgets} <span className="text-xs font-normal text-slate-400">widgets/dash</span></h3>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {/* ---------------- Dashboards Section ---------------- */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <MonitorPlay className="w-5 h-5 text-slate-400" />
                            <h2 className="text-lg font-bold text-slate-900">Dashboards</h2>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                                {dashboards.length}
                            </span>
                        </div>
                    </div>

                    {/* Control Bar - Dashboards */}
                    <div className="flex items-center gap-3 mb-6 p-1">
                        <div className="relative flex-1 max-w-sm group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filter dashboards..."
                                value={dashboardSearch}
                                onChange={(e) => setDashboardSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex-1"></div>
                        {dashboards.length > 0 && (
                            <button
                                onClick={handleCreateDashboard}
                                className="hidden sm:flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                New Dashboard
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Ghost Card for New Dashboard */}
                        <button
                            onClick={handleCreateDashboard}
                            className="group flex flex-col items-center justify-center min-h-[160px] rounded-xl border border-dashed border-slate-300 bg-slate-50/50 hover:bg-white hover:border-indigo-400 hover:shadow-md transition-all duration-200"
                        >
                            <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:border-indigo-200 group-hover:shadow-sm transition-all duration-200">
                                <Plus className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                            </div>
                            <span className="font-medium text-slate-600 group-hover:text-indigo-700 transition-colors">Create Dashboard</span>
                        </button>

                        {/* Dashboard Cards */}
                        {dashboardsLoading ? (
                            <CardsSkeleton count={3} />
                        ) : (
                            filteredDashboards.map((dashboard: Dashboard) => (
                                <DashboardCard
                                    key={dashboard.id}
                                    dashboard={dashboard}
                                    onClick={handleOpenDashboard}
                                    onDelete={handleDeleteDashboard}
                                />
                            ))
                        )}
                    </div>
                </section>

                <div className="h-px bg-slate-200 w-full" />

                {/* ---------------- Production Lines Section ---------------- */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-slate-400" />
                            <h2 className="text-lg font-bold text-slate-900">Production Lines</h2>
                            {factoryQuota && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${factoryQuota.current >= (quotaStatus?.lines_per_factory.max || 0)
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                    {factoryQuota.current} / {quotaStatus?.lines_per_factory.max || 0} Used
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Control Bar - Production Lines */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm py-2 rounded-lg">
                        <div className="relative w-full sm:max-w-xs group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search lines..."
                                value={lineSearch}
                                onChange={(e) => setLineSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <div className="flex items-center p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                                <button
                                    onClick={() => setLineViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-all ${lineViewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setLineViewMode('list')}
                                    className={`p-1.5 rounded-md transition-all ${lineViewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={handleCreateLine}
                                disabled={!canCreateLine}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4" />
                                New Line
                            </button>
                        </div>
                    </div>

                    {/* Content - Grid View */}
                    {lineViewMode === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {/* Ghost Card for New Line */}
                            <button
                                onClick={handleCreateLine}
                                disabled={!canCreateLine}
                                className="group flex flex-col items-center justify-center min-h-[180px] rounded-xl border border-dashed border-slate-300 bg-slate-50/50 hover:bg-white hover:border-indigo-400 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:border-indigo-200 group-hover:shadow-sm transition-all duration-200">
                                    <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                </div>
                                <span className="font-medium text-slate-600 group-hover:text-indigo-700 transition-colors">Add Production Line</span>
                                {!canCreateLine && <span className="text-xs text-red-400 mt-1">Quota limit reached</span>}
                            </button>

                            {linesLoading ? (
                                <CardsSkeleton count={4} />
                            ) : (
                                filteredLines.map((line) => (
                                    <ProductionLineCard
                                        key={line.id}
                                        line={line}
                                        onEdit={handleEditLine}
                                        onDelete={handleDeleteLine}
                                        onUpload={handleUploadLine}
                                        onClick={(lineId) => navigate(`/dashboard/factories/${factoryId}/lines/${lineId}`)}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* Content - List View */}
                    {lineViewMode === 'list' && (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {linesLoading ? (
                                <div className="p-0">
                                    <CardsSkeleton count={5} viewMode="list" />
                                </div>
                            ) : (
                                <>
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredLines.map(line => (
                                                <tr
                                                    key={line.id}
                                                    onClick={() => navigate(`/dashboard/factories/${factoryId}/lines/${line.id}`)}
                                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                                                <Activity className="w-4 h-4" />
                                                            </div>
                                                            <span className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{line.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Active
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => handleUploadLine(line.id)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50">
                                                                <Settings className="w-4 h-4" />
                                                            </button>
                                                            <ChevronRight className="w-4 h-4 text-slate-300 ml-2" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredLines.length === 0 && (
                                        <div className="p-8 text-center text-slate-500">
                                            No lines found matching your search.
                                        </div>
                                    )}
                                </>
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
            <CreateLineModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleLineCreationSuccess}
                factoryId={factory.id}
                factoryName={factory.name}
                quotaStatus={quotaStatus}
            />
            {selectedLineForUpload && (
                <LineUploadModal
                    isOpen={isUploadModalOpen}
                    onClose={() => {
                        setIsUploadModalOpen(false);
                        setSelectedLineForUpload(null);
                    }}
                    onSuccess={handleUploadSuccess}
                    lineId={selectedLineForUpload.id}
                    lineName={selectedLineForUpload.name}
                    factoryId={factory.id}
                />
            )}
            <MappingFlowModal
                isOpen={isMappingModalOpen}
                onClose={() => setIsMappingModalOpen(false)}
                rawImportId={currentRawImportId}
                lineId={mappingLineId}
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
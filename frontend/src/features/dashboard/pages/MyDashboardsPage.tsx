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
    Settings
} from 'lucide-react';
import { MainLayout } from '../../../components/layout/MainLayout';
import { FactoryCard } from '../components/FactoryCard';
import { useListFactoriesApiV1FactoriesGet } from '../../../api/endpoints/factories/factories';
import { useOrganization } from '../../../contexts/OrganizationContext';

type ViewMode = 'grid' | 'list';

export const MyDashboardsPage: React.FC = () => {
    const navigate = useNavigate();

    // Control Bar state
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // consume context
    const { quotaStatus } = useOrganization();

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

    const handleFactoryEdit = (id: string) => {
        // Redirect to settings for configuration
        navigate(`/organization/settings/factories/${id}`);
    };

    if (factoryError) {
        console.error('Error loading factories:', factoryError);
    }

    return (
        <MainLayout>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Production Sites</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isLoadingFactories
                            ? 'Loading your sites...'
                            : factories.length === 0
                                ? 'No active production sites'
                                : `${factories.length} active ${factories.length === 1 ? 'site' : 'sites'} available`
                        }
                    </p>
                </div>

                {/* Settings Link */}
                <Link
                    to="/organization/settings/factories"
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Settings className="w-4 h-4" />
                    Configure Sites
                </Link>
            </div>

            {/* Control Bar - Search & View Toggles */}
            {factories.length > 0 && !isLoadingFactories && (
                <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm py-3 -mx-4 px-4 rounded-lg">
                    {/* Search Input */}
                    <div className="relative group w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            id="factory-search"
                            type="text"
                            placeholder="Search factories..."
                            className="w-full pl-10 pr-16 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
                                <span className="text-xs">Ctrl/⌘ +</span>K
                            </kbd>
                        </div>
                    </div>

                    {/* View Toggles */}
                    <div className="flex items-center p-1 bg-white border border-slate-200 rounded-lg shadow-sm ml-4">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Grid view"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="List view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Search Results Info */}
            {searchQuery && filteredFactories.length !== factories.length && (
                <p className="text-sm text-slate-500 mb-4">
                    Showing {filteredFactories.length} of {factories.length} factories
                </p>
            )}

            {/* Content Area - Grid View */}
            {viewMode === 'grid' && (isLoadingFactories || filteredFactories.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="factories-grid">

                    {/* Loading Skeletons */}
                    {isLoadingFactories ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse bg-white rounded-xl border border-slate-200 p-5">
                                {/* Header: Icon + Name */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg" />
                                        <div className="space-y-2">
                                            <div className="h-4 bg-slate-100 rounded w-32" />
                                            <div className="h-3 bg-slate-100 rounded w-20" />
                                        </div>
                                    </div>
                                    <div className="w-2.5 h-2.5 bg-slate-100 rounded-full" />
                                </div>

                                {/* Metric Row */}
                                <div className="flex items-end justify-between mt-6 pt-4 border-t border-slate-100">
                                    <div>
                                        <div className="h-8 bg-slate-100 rounded w-12 mb-1" />
                                        <div className="h-4 bg-slate-100 rounded w-24" />
                                    </div>
                                    <div className="h-8 bg-slate-100 rounded w-24" />
                                </div>

                                {/* Action Row (Matches FactoryCard height) */}
                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                                    <div className="h-8 bg-slate-100 rounded w-16" />
                                    <div className="h-8 bg-slate-100 rounded w-16" />
                                    <div className="ml-auto h-4 bg-slate-100 rounded w-12" />
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
                                onEdit={handleFactoryEdit}
                                onDelete={() => { }} // No delete capability in Operations view
                            />
                        ))
                    )}
                </div>
            )}

            {/* Content Area - List View */}
            {viewMode === 'list' && !isLoadingFactories && filteredFactories.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="factories-list">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lines</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredFactories.map(factory => {
                                const lineCount = factory.lineCount || 0;
                                const maxLines = quotaStatus?.lines_per_factory.max || 10;
                                const quotaPercentage = (lineCount / maxLines) * 100;

                                const getStatusStyle = () => {
                                    if (quotaPercentage >= 100) return 'bg-red-50 text-red-700 ring-red-600/20';
                                    if (quotaPercentage >= 80) return 'bg-amber-50 text-amber-700 ring-amber-600/20';
                                    return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
                                };

                                const getStatusText = () => {
                                    if (quotaPercentage >= 100) return 'At Limit';
                                    if (quotaPercentage >= 80) return 'Near Limit';
                                    return 'Active';
                                };

                                return (
                                    <tr
                                        key={factory.id}
                                        className="transition-colors group hover:bg-slate-50 cursor-pointer"
                                        onClick={() => navigate(`/dashboard/factories/${factory.id}`)}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                                    <FactoryIcon className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <span className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                    {factory.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-slate-500 font-mono text-sm">
                                            {factory.code || '—'}
                                        </td>
                                        <td className="py-3 px-4 text-slate-700">
                                            {lineCount} / {maxLines}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusStyle()}`}>
                                                {getStatusText()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 inline-block" />
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
                    <Search className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">No factories found</h3>
                    <p className="text-sm text-slate-500">
                        No factories match "{searchQuery}". Try a different search term.
                    </p>
                    <button
                        onClick={() => setSearchQuery('')}
                        className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                        Clear search
                    </button>
                </div>
            )}

            {/* Empty State - Welcoming & Action-Oriented */}
            {!isLoadingFactories && factories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-6 bg-gradient-to-b from-white to-slate-50/50 rounded-2xl border border-slate-100 shadow-sm">
                    {/* Animated Icon */}
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-indigo-200 rounded-full blur-3xl opacity-40 animate-pulse scale-150" />
                        <div className="relative bg-white p-6 rounded-2xl shadow-xl border border-slate-100 group">
                            <Building2 className="w-14 h-14 text-indigo-500" strokeWidth={1.5} />
                        </div>
                    </div>

                    {/* Copy */}
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">No active sites</h2>
                    <p className="text-slate-500 mb-8 text-center max-w-md">
                        Your dashboard is empty because no factories have been configured yet.
                        Head over to Organization Settings to set up your infrastructure.
                    </p>

                    {/* CTA Button */}
                    <Link
                        to="/organization/settings/factories"
                        className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:shadow-indigo-100 transition-all active:scale-[0.98]"
                    >
                        <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                        Go to Organization Settings
                    </Link>
                </div>
            )}
        </MainLayout>
    );
};

export default MyDashboardsPage;
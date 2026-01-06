/**
 * My Dashboards Gallery Page
 * 
 * Command Center style dashboard for managing production sites
 * Inspired by Vercel, Linear, and Stripe design patterns
 * 
 * Features:
 * - Control Bar with search and view toggles
 * - Grid and List view modes
 * - Modern SaaS design patterns
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Building2,
    Search,
    LayoutGrid,
    List,
    ChevronRight,
    Factory as FactoryIcon,
    Loader2
} from 'lucide-react';
import { MainLayout } from '../../../components/layout/MainLayout';
import { FactoryCard } from '../components/FactoryCard';
import { FactoryCreationModal } from '../components/FactoryCreationModal';
// Using generated hook for data fetching
import { useListFactoriesApiV1FactoriesGet } from '../../../api/endpoints/factories/factories';

import { useOrganization } from '../../../contexts/OrganizationContext';

type ViewMode = 'grid' | 'list';

const FactoryProvisioningCard = () => (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5 relative overflow-hidden">
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />

        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900">Creating Factory...</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Provisioning resources</p>
                </div>
            </div>
        </div>

        <div className="space-y-3 mt-6 opacity-60">
            <div className="h-px bg-slate-100 w-full" />
            <div className="flex justify-between items-center">
                <div className="h-2 bg-slate-100 rounded w-16" />
                <div className="h-6 bg-slate-100 rounded-full w-12" />
            </div>
        </div>
    </div>
);

export const MyDashboardsPage: React.FC = () => {
    const navigate = useNavigate();

    // Factory management state
    const [isFactoryModalOpen, setIsFactoryModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [deletingFactoryId, setDeletingFactoryId] = useState<string | null>(null);

    // Control Bar state
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // consume context
    const { quotaStatus, refreshQuota } = useOrganization();

    // Use Orval hook for fetching factories
    const {
        data: factoriesData,
        isLoading: isLoadingFactories,
        error: factoryError,
        refetch: refetchFactories
    } = useListFactoriesApiV1FactoriesGet();

    // Enrich factories with line counts from Context if available
    const factories = useMemo(() => {
        if (!factoriesData) return [];

        return factoriesData.map((factory: any) => {
            const quotaInfo = quotaStatus?.lines_per_factory.by_factory.find(
                q => q.factory_id === factory.id
            );

            // Calculate actual lines:
            // 1. Try to get the length of the production_lines array from the factory object
            // 2. Fallback to the quota system's count
            // 3. Default to 0
            const actualLineCount = factory.production_lines?.length ?? quotaInfo?.current ?? 0;

            return {
                ...factory,
                // Ensure code is string or undefined for UI
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

    const handleCreateFactory = () => {
        if (!quotaStatus?.factories.can_create) {
            alert('Factory quota limit reached. Please upgrade your plan to create more factories.');
            return;
        }
        setIsFactoryModalOpen(true);
    };

    const handleFactoryCreationSuccess = async () => {
        setIsFactoryModalOpen(false);
        setIsCreating(true);
        setSearchQuery('');

        try {
            await Promise.all([
                refetchFactories(), // Reload factory list via React Query
                refreshQuota() // Refresh quota status to update the display
            ]);
        } finally {
            setIsCreating(false);
        }
    };

    const handleFactoryEdit = (id: string) => {
        console.log('Edit factory:', id);
        alert('Factory editing will be available soon!');
    };

    const handleFactoryDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this factory? This will also delete all associated production lines.')) {
            // Set deleting state immediately for instant UI feedback
            setDeletingFactoryId(id);
            try {
                // Keep manual import for delete until we refactor the delete action too
                const { deleteFactory } = await import('../../../lib/factoryApi');
                await deleteFactory(id);
                await Promise.all([
                    refetchFactories(), // Reload factory list
                    refreshQuota() // Refresh quota status
                ]);
            } catch (error) {
                console.error('Failed to delete factory:', error);
                alert('Failed to delete factory. It may contain active resources.');
            } finally {
                setDeletingFactoryId(null);
            }
        }
    };

    if (factoryError) {
        // Simple error handling for now
        console.error('Error loading factories:', factoryError);
    }

    return (
        <MainLayout>
            {/* Command Center Header - Single Row, Action-Oriented */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Production Sites</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isLoadingFactories
                            ? 'Loading your sites...'
                            : factories.length === 0
                                ? 'Get started by creating your first site'
                                : `${factories.length} active ${factories.length === 1 ? 'site' : 'sites'} across your organization`
                        }
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Subtle Quota Badge - Only shows usage context when items exist */}
                    {quotaStatus && factories.length > 0 && (
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                            {quotaStatus.factories.current} / {quotaStatus.factories.max} Used
                        </span>
                    )}

                    {/* Primary Action Button */}
                    <button
                        onClick={handleCreateFactory}
                        disabled={!quotaStatus?.factories.can_create}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Factory
                    </button>
                </div>
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
            {viewMode === 'grid' && (isLoadingFactories || filteredFactories.length > 0 || isCreating) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="factories-grid">
                    {isCreating && <FactoryProvisioningCard />}

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
                        <>
                            {/* Actual Factory Cards */}
                            {filteredFactories.map(factory => {
                                const isDeleting = deletingFactoryId === factory.id;
                                return (
                                    <div key={factory.id} className="relative">
                                        {/* Deleting Overlay */}
                                        {isDeleting && (
                                            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span className="text-sm font-medium">Deleting...</span>
                                                </div>
                                            </div>
                                        )}
                                        <FactoryCard
                                            factory={{
                                                id: factory.id,
                                                name: factory.name,
                                                code: factory.code,
                                                lineCount: factory.lineCount || 0,
                                                maxLines: quotaStatus?.lines_per_factory.max || 10
                                            }}
                                            onClick={(id) => !isDeleting && navigate(`/dashboard/factories/${id}`)}
                                            onEdit={handleFactoryEdit}
                                            onDelete={handleFactoryDelete}
                                        />
                                    </div>
                                );
                            })}

                            {/* Ghost Card - Elegant "Add New" experience */}
                            {/* This sits inside the grid as the last item */}
                            {quotaStatus?.factories.can_create && !searchQuery && (
                                <button
                                    onClick={handleCreateFactory}
                                    className="group flex flex-col items-center justify-center min-h-[180px] rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-lg transition-all duration-200"
                                >
                                    <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:border-indigo-200 group-hover:shadow-md transition-all duration-200">
                                        <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                    <span className="font-medium text-slate-600 group-hover:text-indigo-700 transition-colors">Add Factory</span>
                                    <span className="text-xs text-slate-400 mt-1 group-hover:text-indigo-500 transition-colors">
                                        {quotaStatus.factories.max - quotaStatus.factories.current} slot{quotaStatus.factories.max - quotaStatus.factories.current !== 1 ? 's' : ''} available
                                    </span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Content Area - List View */}
            {viewMode === 'list' && !isLoadingFactories && (filteredFactories.length > 0 || isCreating) && (
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
                            {isCreating && (
                                <tr className="bg-indigo-50/30 animate-pulse">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                            <span className="font-medium text-indigo-900">Provisioning...</span>
                                        </div>
                                    </td>
                                    <td colSpan={4} className="py-3 px-4 text-xs text-indigo-500">
                                        Setting up environment...
                                    </td>
                                </tr>
                            )}
                            {filteredFactories.map(factory => {
                                const lineCount = factory.lineCount || 0;
                                const maxLines = quotaStatus?.lines_per_factory.max || 10;
                                const quotaPercentage = (lineCount / maxLines) * 100;
                                const isDeleting = deletingFactoryId === factory.id;

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
                                        className={`transition-colors group ${isDeleting
                                            ? 'bg-slate-50 opacity-60 pointer-events-none'
                                            : 'hover:bg-slate-50 cursor-pointer'
                                            }`}
                                        onClick={() => !isDeleting && navigate(`/dashboard/factories/${factory.id}`)}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                                    {isDeleting ? (
                                                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                                                    ) : (
                                                        <FactoryIcon className="w-4 h-4 text-indigo-600" />
                                                    )}
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
                                            {isDeleting ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Deleting...
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusStyle()}`}>
                                                    {getStatusText()}
                                                </span>
                                            )}
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
            {!isLoadingFactories && factories.length === 0 && !isCreating && (
                <div className="flex flex-col items-center justify-center py-20 px-6 bg-gradient-to-b from-white to-slate-50/50 rounded-2xl border border-slate-100 shadow-sm">
                    {/* Animated Icon */}
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-indigo-200 rounded-full blur-3xl opacity-40 animate-pulse scale-150" />
                        <div className="relative bg-white p-6 rounded-2xl shadow-xl border border-slate-100 group">
                            <Building2 className="w-14 h-14 text-indigo-500" strokeWidth={1.5} />
                        </div>
                    </div>

                    {/* Copy */}
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to LineSight</h2>
                    <p className="text-slate-500 mb-8 text-center max-w-md">
                        Create your first production site to start tracking real-time metrics,
                        analyzing performance, and optimizing your manufacturing operations.
                    </p>

                    {/* CTA Button */}
                    <button
                        onClick={handleCreateFactory}
                        disabled={!quotaStatus?.factories.can_create}
                        className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                        Create Your First Factory
                    </button>

                    {/* Quota hint for empty state */}
                    {quotaStatus && (
                        <p className="text-xs text-slate-400 mt-4">
                            You can create up to {quotaStatus.factories.max} {quotaStatus.factories.max === 1 ? 'factory' : 'factories'} on your current plan
                        </p>
                    )}
                </div>
            )}

            <FactoryCreationModal
                isOpen={isFactoryModalOpen}
                onClose={() => setIsFactoryModalOpen(false)}
                onSuccess={handleFactoryCreationSuccess}
                quotaStatus={quotaStatus}
            />
        </MainLayout>
    );
};

export default MyDashboardsPage;
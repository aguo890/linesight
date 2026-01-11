import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    LayoutGrid,
    List,
    Factory as FactoryIcon,
    Users,
    Layers,
    Plus,
    MoreHorizontal,
    ChevronRight,
    ArrowLeft,
    Pencil,
    Trash2
} from 'lucide-react';

// API & Context
import { listFactories, listDataSources, deleteFactory, type Factory } from '../../../lib/factoryApi';
import { listOrgMembers, type MemberRead } from '../../../api/endpoints/team/teamApi';
import { useOrganization } from '../../../contexts/OrganizationContext';

// Components
import { FactoryCreationModal } from '../components/FactoryCreationModal';
import { FactoryEditModal } from '../components/FactoryEditModal';

// Types
type ViewMode = 'grid' | 'list';

export const FactorySelectionPage: React.FC = () => {
    const navigate = useNavigate();

    // State
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [factories, setFactories] = useState<Factory[]>([]);
    const [members, setMembers] = useState<MemberRead[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Actions State
    const [factoryToEdit, setFactoryToEdit] = useState<Factory | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Context
    const { quotaStatus, refreshQuota } = useOrganization();

    // -- Data Fetching --
    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [factoriesRes, membersRes] = await Promise.all([
                listFactories(),
                listOrgMembers(),
            ]);

            // Enrich with data sources
            const factoriesWithSources: Factory[] = await Promise.all(
                factoriesRes.map(async (factory: Factory) => {
                    try {
                        const sources = await listDataSources(factory.id);
                        return { ...factory, data_sources: sources || [] };
                    } catch {
                        return { ...factory, data_sources: [] };
                    }
                })
            );

            setFactories(factoriesWithSources);
            setMembers(membersRes.data);
        } catch (err: any) {
            console.error('Failed to fetch data:', err);
            setError(err.response?.data?.detail || 'Failed to load factories.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // -- Helpers --
    const getManagerCount = (factory: Factory): number => {
        const sourceIds = factory.data_sources?.map((ds) => ds.id) || [];
        // Managers assigned to any data source in this factory
        const assignedManagers = members.filter(
            (m) =>
                m.role === 'manager' &&
                (m.scopes || []).some((s) => sourceIds.includes(s.data_source_id || ''))
        );
        return assignedManagers.length;
    };

    const handleDelete = async (factoryId: string, factoryName: string) => {
        if (!confirm(`Are you sure you want to delete ${factoryName}? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteFactory(factoryId);
            fetchData();
            refreshQuota();
        } catch (err: any) {
            alert('Failed to delete factory: ' + (err.response?.data?.detail || err.message));
        }
    };

    // -- Memoized Filters --
    const filteredFactories = useMemo(() => {
        if (!searchQuery.trim()) return factories;
        const query = searchQuery.toLowerCase();
        return factories.filter(factory =>
            factory.name.toLowerCase().includes(query) ||
            factory.code?.toLowerCase().includes(query)
        );
    }, [factories, searchQuery]);

    // -- Keyboard Shortcut --
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('org-factory-search')?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleCreateSuccess = () => {
        setIsCreateModalOpen(false);
        refreshQuota();
        fetchData();
    };

    const handleEditSuccess = () => {
        setFactoryToEdit(null);
        fetchData();
    };

    // -- Render --
    return (
        <div className="max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <button
                        onClick={() => navigate('/organization/settings')}
                        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Settings
                    </button>
                    <h1 className="text-2xl font-bold text-text-main">Infrastructure</h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* Stats Pills - Simplified for Header */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-surface-subtle rounded-lg border border-border text-xs font-medium text-text-muted">
                        <FactoryIcon className="w-3.5 h-3.5" />
                        {factories.length} Sites
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Factory
                    </button>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-surface/80 backdrop-blur-md py-3 -mx-4 px-4 rounded-lg">
                <div className="relative group w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                    <input
                        id="org-factory-search"
                        type="text"
                        placeholder="Search factories..."
                        className="w-full pl-10 pr-16 py-2 bg-surface text-text-main placeholder:text-text-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-surface-subtle px-1.5 font-mono text-[10px] font-medium text-text-muted">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>

                <div className="flex items-center p-1 bg-surface border border-border rounded-lg shadow-sm ml-4">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-brand/10 text-brand shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-brand/10 text-brand shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 bg-danger/10 text-danger p-4 rounded-xl border border-danger/20 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={fetchData} className="text-sm font-medium hover:underline">Retry</button>
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Ghost Card for New Factory (Always visible in Grid) */}
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="group flex flex-col items-center justify-center gap-3 min-h-[220px] rounded-xl border-2 border-dashed border-border hover:border-brand/50 hover:bg-brand/5 transition-all"
                    >
                        <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center group-hover:scale-110 group-hover:border-brand/30 group-hover:bg-surface transition-all">
                            <Plus className="w-6 h-6 text-text-muted group-hover:text-brand" />
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-text-main group-hover:text-brand-dark dark:group-hover:text-brand-light">New Factory</p>
                            <p className="text-xs text-text-muted mt-1">Add a new production site</p>
                        </div>
                    </button>

                    {/* Skeletons */}
                    {isLoading && [1, 2, 3].map(i => (
                        <div key={i} className="bg-surface rounded-xl border border-border p-5 animate-pulse">
                            <div className="flex gap-4 mb-6">
                                <div className="w-12 h-12 bg-surface-subtle rounded-lg" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-surface-subtle rounded w-3/4" />
                                    <div className="h-3 bg-surface-subtle rounded w-1/4" />
                                </div>
                            </div>
                            <div className="h-10 bg-surface-subtle rounded w-full" />
                        </div>
                    ))}

                    {/* Factory Cards */}
                    {!isLoading && filteredFactories.map((factory) => {
                        const sourceCount = factory.data_sources?.length || 0;
                        const managerCount = getManagerCount(factory);
                        const isMenuOpen = activeMenuId === factory.id;

                        return (
                            <div
                                key={factory.id}
                                onClick={() => navigate(`${factory.id}`)}
                                className="group bg-surface rounded-xl border border-border p-5 cursor-pointer hover:shadow-lg hover:border-brand/30 transition-all relative"
                            >
                                {/* Card Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand group-hover:scale-110 transition-transform">
                                            <FactoryIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-text-main group-hover:text-brand transition-colors">
                                                {factory.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs font-mono text-text-muted bg-surface-subtle px-1.5 py-0.5 rounded">
                                                    {factory.code}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Menu */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(isMenuOpen ? null : factory.id);
                                            }}
                                            className={`p-1 rounded hover:bg-surface-subtle transition-colors ${isMenuOpen ? 'text-brand bg-surface-subtle' : 'text-text-muted/60 hover:text-text-muted'}`}
                                        >
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>

                                        {isMenuOpen && (
                                            <div
                                                className="absolute right-0 top-full mt-1 w-48 bg-surface rounded-lg shadow-lg border border-border py-1 z-20"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={() => {
                                                        setActiveMenuId(null);
                                                        setFactoryToEdit(factory);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface-subtle flex items-center gap-2"
                                                >
                                                    <Pencil className="w-4 h-4" /> Edit Details
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setActiveMenuId(null);
                                                        handleDelete(factory.id, factory.name);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete Factory
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Metrics */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-surface-subtle rounded-lg p-3 border border-border">
                                        <div className="text-xs text-text-muted flex items-center gap-1 mb-1">
                                            <Layers className="w-3 h-3" /> Data Sources
                                        </div>
                                        <div className="font-semibold text-text-main">{sourceCount}</div>
                                    </div>
                                    <div className="bg-surface-subtle rounded-lg p-3 border border-border">
                                        <div className="text-xs text-text-muted flex items-center gap-1 mb-1">
                                            <Users className="w-3 h-3" /> Managers
                                        </div>
                                        <div className="font-semibold text-text-main">{managerCount}</div>
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="flex items-center text-sm font-medium text-brand opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                    Configure Site <ChevronRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && !isLoading && (
                <div className="bg-surface rounded-xl border border-border overflow-visible shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-surface-subtle border-b border-border">
                            <tr>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase">Name</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase">Code</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase">Sources</th>
                                <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase">Managers</th>
                                <th className="py-3 px-4 text-right text-xs font-semibold text-text-muted uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredFactories.map((factory) => {
                                const isMenuOpen = activeMenuId === factory.id;
                                return (
                                    <tr
                                        key={factory.id}
                                        onClick={() => navigate(`${factory.id}`)}
                                        className="hover:bg-surface-subtle cursor-pointer group transition-colors"
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <FactoryIcon className="w-4 h-4 text-text-muted group-hover:text-brand transition-colors" />
                                                <span className="font-medium text-text-main">{factory.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 font-mono text-xs text-text-muted">{factory.code}</td>
                                        <td className="py-3 px-4 text-text-muted">{factory.data_sources?.length || 0}</td>
                                        <td className="py-3 px-4 text-text-muted">{getManagerCount(factory)}</td>
                                        <td className="py-3 px-4 text-right relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenuId(isMenuOpen ? null : factory.id);
                                                }}
                                                className={`p-1 rounded hover:bg-surface-subtle transition-colors ${isMenuOpen ? 'text-brand bg-surface-subtle' : 'text-text-muted/60 hover:text-text-muted'}`}
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>

                                            {isMenuOpen && (
                                                <div
                                                    className="absolute right-8 top-0 mt-1 w-48 bg-surface rounded-lg shadow-lg border border-border py-1 z-20 text-left"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            setActiveMenuId(null);
                                                            setFactoryToEdit(factory);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface-subtle flex items-center gap-2"
                                                    >
                                                        <Pencil className="w-4 h-4" /> Edit Details
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setActiveMenuId(null);
                                                            handleDelete(factory.id, factory.name);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Delete Factory
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredFactories.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-text-muted">
                                        No factories found matching "{searchQuery}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <FactoryCreationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleCreateSuccess}
                quotaStatus={quotaStatus}
            />

            <FactoryEditModal
                isOpen={!!factoryToEdit}
                onClose={() => setFactoryToEdit(null)}
                onSuccess={handleEditSuccess}
                factory={factoryToEdit}
            />
        </div>
    );
};

export default FactorySelectionPage;

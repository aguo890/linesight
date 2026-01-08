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
    Settings,
    ChevronRight,
    ArrowLeft,
    Pencil,
    Trash2
} from 'lucide-react';

// API & Context
import { AXIOS_INSTANCE } from '../../../api/axios-client';
import { listOrgMembers, type MemberRead } from '../../../api/endpoints/team/teamApi';
import { deleteFactory } from '../../../lib/factoryApi';
import { useOrganization } from '../../../contexts/OrganizationContext';

// Components
import { FactoryCreationModal } from '../components/FactoryCreationModal';
import { FactoryEditModal } from '../components/FactoryEditModal';

// Types
type ViewMode = 'grid' | 'list';

interface ProductionLine {
    id: string;
    name: string;
}

interface Factory {
    id: string;
    name: string;
    code: string;
    production_lines?: ProductionLine[];
}

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
                AXIOS_INSTANCE.get('/api/v1/factories'),
                listOrgMembers(),
            ]);

            // Enrich with lines
            const factoriesWithLines: Factory[] = await Promise.all(
                factoriesRes.data.map(async (factory: Factory) => {
                    try {
                        const linesRes = await AXIOS_INSTANCE.get(`/api/v1/factories/${factory.id}/lines`);
                        return { ...factory, production_lines: linesRes.data || [] };
                    } catch {
                        return { ...factory, production_lines: [] };
                    }
                })
            );

            setFactories(factoriesWithLines);
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
        const lineIds = factory.production_lines?.map((l) => l.id) || [];
        // Managers assigned to any line in this factory
        const assignedManagers = members.filter(
            (m) =>
                m.role === 'manager' &&
                m.scopes?.some((s) => lineIds.includes(s.production_line_id || ''))
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <button
                        onClick={() => navigate('/organization/settings')}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Settings
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">Infrastructure</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Configure factories, manage production lines, and assign managers.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Stats Pills - Simplified for Header */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
                        <FactoryIcon className="w-3.5 h-3.5" />
                        {factories.length} Sites
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Factory
                    </button>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm py-3 -mx-4 px-4 rounded-lg">
                <div className="relative group w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        id="org-factory-search"
                        type="text"
                        placeholder="Search factories..."
                        className="w-full pl-10 pr-16 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>

                <div className="flex items-center p-1 bg-white border border-slate-200 rounded-lg shadow-sm ml-4">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-center justify-between">
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
                        className="group flex flex-col items-center justify-center gap-3 min-h-[220px] rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-500/50 hover:bg-indigo-50/50 transition-all"
                    >
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:scale-110 group-hover:border-indigo-200 group-hover:bg-white transition-all">
                            <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-500" />
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-slate-900 group-hover:text-indigo-700">New Factory</p>
                            <p className="text-xs text-slate-500 mt-1">Add a new production site</p>
                        </div>
                    </button>

                    {/* Skeletons */}
                    {isLoading && [1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                            <div className="flex gap-4 mb-6">
                                <div className="w-12 h-12 bg-slate-100 rounded-lg" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                                </div>
                            </div>
                            <div className="h-10 bg-slate-100 rounded w-full" />
                        </div>
                    ))}

                    {/* Factory Cards */}
                    {!isLoading && filteredFactories.map((factory) => {
                        const lineCount = factory.production_lines?.length || 0;
                        const managerCount = getManagerCount(factory);
                        const isMenuOpen = activeMenuId === factory.id;

                        return (
                            <div
                                key={factory.id}
                                onClick={() => navigate(`${factory.id}`)}
                                className="group bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:shadow-lg hover:border-indigo-200 transition-all relative"
                            >
                                {/* Card Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                            <FactoryIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {factory.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
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
                                            className={`p-1 rounded hover:bg-slate-100 transition-colors ${isMenuOpen ? 'text-indigo-600 bg-slate-100' : 'text-slate-300 hover:text-slate-600'}`}
                                        >
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>

                                        {isMenuOpen && (
                                            <div
                                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-20"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={() => {
                                                        setActiveMenuId(null);
                                                        setFactoryToEdit(factory);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <Pencil className="w-4 h-4" /> Edit Details
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setActiveMenuId(null);
                                                        handleDelete(factory.id, factory.name);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete Factory
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Metrics */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                                            <Layers className="w-3 h-3" /> Lines
                                        </div>
                                        <div className="font-semibold text-slate-700">{lineCount}</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                                            <Users className="w-3 h-3" /> Managers
                                        </div>
                                        <div className="font-semibold text-slate-700">{managerCount}</div>
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="flex items-center text-sm font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                    Configure Site <ChevronRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && !isLoading && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-visible shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Name</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Code</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Lines</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Managers</th>
                                <th className="py-3 px-4 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredFactories.map((factory) => {
                                const isMenuOpen = activeMenuId === factory.id;
                                return (
                                    <tr
                                        key={factory.id}
                                        onClick={() => navigate(`${factory.id}`)}
                                        className="hover:bg-slate-50 cursor-pointer group transition-colors"
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <FactoryIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                                <span className="font-medium text-slate-900">{factory.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{factory.code}</td>
                                        <td className="py-3 px-4 text-slate-600">{factory.production_lines?.length || 0}</td>
                                        <td className="py-3 px-4 text-slate-600">{getManagerCount(factory)}</td>
                                        <td className="py-3 px-4 text-right relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenuId(isMenuOpen ? null : factory.id);
                                                }}
                                                className={`p-1 rounded hover:bg-slate-100 transition-colors ${isMenuOpen ? 'text-indigo-600 bg-slate-100' : 'text-slate-300 hover:text-slate-600'}`}
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>

                                            {isMenuOpen && (
                                                <div
                                                    className="absolute right-8 top-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-20 text-left"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            setActiveMenuId(null);
                                                            setFactoryToEdit(factory);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                    >
                                                        <Pencil className="w-4 h-4" /> Edit Details
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setActiveMenuId(null);
                                                            handleDelete(factory.id, factory.name);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
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
                                    <td colSpan={5} className="py-8 text-center text-slate-500">
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

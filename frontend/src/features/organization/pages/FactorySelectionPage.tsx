/**
 * Factory Selection Page (Hub)
 * 
 * Grid of factory cards. Click to drill down into per-factory assignment.
 * Inspired by MyDashboardsPage design patterns.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AXIOS_INSTANCE } from '../../../api/axios-client';
import { listOrgMembers, type MemberRead } from '../../../api/endpoints/team/teamApi';
import { Factory as FactoryIcon, Users, Layers, ChevronRight, ArrowLeft, Plus } from 'lucide-react';
import { FactoryCreationModal } from '../components/FactoryCreationModal';
import { useOrganization } from '../../../contexts/OrganizationContext';

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

const FactorySelectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { quotaStatus, refreshQuota } = useOrganization();

    const [factories, setFactories] = useState<Factory[]>([]);
    const [members, setMembers] = useState<MemberRead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [factoriesRes, membersRes] = await Promise.all([
                AXIOS_INSTANCE.get('/api/v1/factories'),
                listOrgMembers(),
            ]);

            // Fetch production lines for each factory
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
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Count managers assigned to a factory (via any of its lines)
    const getManagerCount = (factory: Factory): number => {
        const lineIds = factory.production_lines?.map((l) => l.id) || [];
        const managers = members.filter(
            (m) =>
                m.role === 'manager' &&
                m.scopes?.some((s) => lineIds.includes(s.production_line_id || ''))
        );
        return managers.length;
    };

    const handleCreateSuccess = () => {
        setIsCreateModalOpen(false);
        refreshQuota(); // Refresh quota after creation
        fetchData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="bg-red-50 p-6 rounded-xl text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => fetchData()}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <button
                        onClick={() => navigate('/organization/settings/members')}
                        className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-3"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Members
                    </button>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Factory Infrastructure</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">
                        Select a factory to configure its structure and map assigned managers.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Factory
                </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <FactoryIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-[var(--color-text)]">{factories.length}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Factories</div>
                        </div>
                    </div>
                </div>
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <Layers className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-[var(--color-text)]">
                                {factories.reduce((acc, f) => acc + (f.production_lines?.length || 0), 0)}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">Production Lines</div>
                        </div>
                    </div>
                </div>
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <Users className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-[var(--color-text)]">
                                {members.filter((m) => m.role === 'manager').length}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">Total Managers</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Factory Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {factories.map((factory) => {
                    const lineCount = factory.production_lines?.length || 0;
                    const managerCount = getManagerCount(factory);

                    return (
                        <button
                            key={factory.id}
                            onClick={() => navigate(`${factory.id}`)}
                            className="group bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 text-left hover:shadow-lg hover:border-[var(--color-primary)]/30 transition-all"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                                    <FactoryIcon className="w-6 h-6 text-indigo-600" />
                                </div>
                                <span className="text-xs font-mono bg-[var(--color-background)] text-[var(--color-text-muted)] px-2 py-1 rounded border border-[var(--color-border)]">
                                    {factory.code}
                                </span>
                            </div>

                            {/* Name */}
                            <h3 className="text-lg font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors mb-1 truncate" title={factory.name}>
                                {factory.name}
                            </h3>

                            {/* Stats */}
                            <div className="flex items-center gap-4 mt-4 text-sm text-[var(--color-text-muted)]">
                                <span className="flex items-center gap-1.5">
                                    <Layers className="w-4 h-4" />
                                    {lineCount} {lineCount === 1 ? 'Line' : 'Lines'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-4 h-4" />
                                    {managerCount} {managerCount === 1 ? 'Manager' : 'Managers'}
                                </span>
                            </div>

                            {/* Action Hint */}
                            <div className="flex items-center justify-end mt-4 pt-3 border-t border-[var(--color-border)]">
                                <span className="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors flex items-center gap-1">
                                    Configure
                                    <ChevronRight className="w-4 h-4" />
                                </span>
                            </div>
                        </button>
                    );
                })}

                {/* Ghost Card for New Factory */}
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="group border-2 border-dashed border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)] transition-all min-h-[200px]"
                >
                    <div className="p-4 bg-[var(--color-surface)] rounded-full group-hover:scale-110 transition-transform">
                        <Plus className="w-8 h-8 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)]">Add New Factory</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">Expand your infrastructure</p>
                    </div>
                </button>
            </div>

            <FactoryCreationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleCreateSuccess}
                quotaStatus={quotaStatus}
            />
        </div>
    );
};

export default FactorySelectionPage;

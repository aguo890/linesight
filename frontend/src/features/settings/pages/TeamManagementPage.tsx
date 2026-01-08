/**
 * Team Management Page
 * 
 * Enables organization owners to drag-and-drop managers into production lines.
 * Uses the UserScope model for granular access control.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import {
    listOrgMembers,
    assignUserToLine,
    removeUserScope,
    type MemberRead,
    type ScopeRead,
} from '../../../api/endpoints/team/teamApi';
import { AXIOS_INSTANCE } from '../../../api/axios-client';
import { MainLayout } from '../../../components/layout/MainLayout';

// =============================================================================
// Types
// =============================================================================

interface ProductionLine {
    id: string;
    name: string;
    code: string;
}

interface Factory {
    id: string;
    name: string;
    code: string;
    production_lines: ProductionLine[];
}

// =============================================================================
// Component
// =============================================================================

const TeamManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // State
    const [members, setMembers] = useState<MemberRead[]>([]);
    const [factories, setFactories] = useState<Factory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [draggedMember, setDraggedMember] = useState<MemberRead | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Check if user is owner
    const isOwner = user?.role === 'owner' || user?.role === 'system_admin';

    // ==========================================================================
    // Data Fetching
    // ==========================================================================

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch members and factories in parallel
            const [membersRes, factoriesRes] = await Promise.all([
                listOrgMembers(),
                AXIOS_INSTANCE.get('/api/v1/factories'),
            ]);

            setMembers(membersRes.data);

            // Fetch production lines for each factory
            const factoriesWithLines: Factory[] = await Promise.all(
                factoriesRes.data.map(async (factory: any) => {
                    try {
                        const linesRes = await AXIOS_INSTANCE.get(`/api/v1/factories/${factory.id}/lines`);
                        return {
                            ...factory,
                            production_lines: linesRes.data || [],
                        };
                    } catch {
                        return { ...factory, production_lines: [] };
                    }
                })
            );

            setFactories(factoriesWithLines);
        } catch (err: any) {
            console.error('Failed to fetch data:', err);
            if (err.response?.status === 403) {
                setError('Access denied. Only organization owners can manage team assignments.');
            } else {
                setError('Failed to load team data. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOwner) {
            navigate('/dashboard');
            return;
        }
        fetchData();
    }, [isOwner, navigate, fetchData]);

    // ==========================================================================
    // Helpers
    // ==========================================================================

    // Get unassigned managers (users with role=manager and no scopes)
    const unassignedMembers = members.filter(
        (m) => m.role === 'manager' && m.scopes.length === 0
    );

    // Get members assigned to a specific line
    const getMembersForLine = (lineId: string): MemberRead[] => {
        return members.filter((m) =>
            m.scopes.some((s) => s.production_line_id === lineId)
        );
    };

    // Get scope for member on a specific line
    const getScopeForLine = (member: MemberRead, lineId: string): ScopeRead | undefined => {
        return member.scopes.find((s) => s.production_line_id === lineId);
    };

    // ==========================================================================
    // Drag and Drop Handlers
    // ==========================================================================

    const handleDragStart = (e: React.DragEvent, member: MemberRead) => {
        setDraggedMember(member);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', member.id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnLine = async (e: React.DragEvent, lineId: string) => {
        e.preventDefault();
        if (!draggedMember || actionLoading) return;

        // Check if already assigned to this line
        if (draggedMember.scopes.some((s) => s.production_line_id === lineId)) {
            setDraggedMember(null);
            return;
        }

        try {
            setActionLoading(true);
            await assignUserToLine(draggedMember.id, {
                production_line_id: lineId,
                role: 'manager',
            });
            await fetchData(); // Refresh data
        } catch (err: any) {
            console.error('Failed to assign user:', err);
            setError(err.response?.data?.detail || 'Failed to assign user to line');
        } finally {
            setActionLoading(false);
            setDraggedMember(null);
        }
    };

    const handleDropOnUnassigned = async (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedMember || actionLoading) return;

        // Remove all scopes
        try {
            setActionLoading(true);
            for (const scope of draggedMember.scopes) {
                await removeUserScope(draggedMember.id, scope.id);
            }
            await fetchData(); // Refresh data
        } catch (err: any) {
            console.error('Failed to unassign user:', err);
            setError(err.response?.data?.detail || 'Failed to remove user assignment');
        } finally {
            setActionLoading(false);
            setDraggedMember(null);
        }
    };

    const handleDragEnd = () => {
        setDraggedMember(null);
    };

    const handleRemoveScope = async (memberId: string, scopeId: string) => {
        if (actionLoading) return;

        try {
            setActionLoading(true);
            await removeUserScope(memberId, scopeId);
            await fetchData();
        } catch (err: any) {
            console.error('Failed to remove scope:', err);
            setError(err.response?.data?.detail || 'Failed to remove assignment');
        } finally {
            setActionLoading(false);
        }
    };

    // ==========================================================================
    // Render
    // ==========================================================================

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-accent)]"></div>
                        <p className="text-[var(--color-text-muted)] text-sm">Loading team data...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="bg-[var(--color-surface)] p-8 rounded-xl shadow-lg max-w-md text-center">
                        <div className="text-red-500 text-4xl mb-4">⚠️</div>
                        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">Error</h2>
                        <p className="text-[var(--color-text-muted)] mb-4">{error}</p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[var(--color-text)]">Organization</h1>
                    <p className="text-[var(--color-text-muted)] mt-2">
                        Drag and drop managers to assign them to production lines.
                    </p>
                </div>

                {actionLoading && (
                    <div className="fixed top-4 right-4 bg-[var(--color-accent)] text-white px-4 py-2 rounded-lg shadow-lg z-50">
                        Updating...
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel: Unassigned Members */}
                    <div className="lg:col-span-1">
                        <div
                            className={`bg-[var(--color-surface)] rounded-xl shadow-lg p-4 min-h-[400px] border-2 transition-all ${draggedMember && draggedMember.scopes.length > 0
                                ? 'border-[var(--color-accent)] border-dashed'
                                : 'border-transparent'
                                }`}
                            onDragOver={handleDragOver}
                            onDrop={handleDropOnUnassigned}
                        >
                            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                                Unassigned Managers ({unassignedMembers.length})
                            </h2>
                            <div className="space-y-2">
                                {unassignedMembers.length === 0 ? (
                                    <p className="text-[var(--color-text-muted)] text-sm italic">
                                        All managers are assigned to lines.
                                    </p>
                                ) : (
                                    unassignedMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, member)}
                                            onDragEnd={handleDragEnd}
                                            className="bg-[var(--color-background)] p-3 rounded-lg cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border border-[var(--color-border)]"
                                        >
                                            <div className="font-medium text-[var(--color-text)]">
                                                {member.full_name || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-[var(--color-text-muted)]">
                                                {member.email}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Factories and Lines */}
                    <div className="lg:col-span-2 space-y-6">
                        {factories.length === 0 ? (
                            <div className="bg-[var(--color-surface)] rounded-xl shadow-lg p-8 text-center">
                                <p className="text-[var(--color-text-muted)]">
                                    No factories found. Create a factory first.
                                </p>
                            </div>
                        ) : (
                            factories.map((factory) => (
                                <div
                                    key={factory.id}
                                    className="bg-[var(--color-surface)] rounded-xl shadow-lg p-4"
                                >
                                    <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                        {factory.name}
                                        <span className="text-sm text-[var(--color-text-muted)]">
                                            ({factory.code})
                                        </span>
                                    </h2>

                                    {factory.production_lines?.length === 0 ? (
                                        <p className="text-[var(--color-text-muted)] text-sm italic">
                                            No production lines in this factory.
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {factory.production_lines?.map((line) => {
                                                const lineMembers = getMembersForLine(line.id);
                                                return (
                                                    <div
                                                        key={line.id}
                                                        className={`border rounded-lg p-3 min-h-[120px] transition-all ${draggedMember &&
                                                            !draggedMember.scopes.some(
                                                                (s) => s.production_line_id === line.id
                                                            )
                                                            ? 'border-[var(--color-accent)] border-dashed bg-[var(--color-accent)]/5'
                                                            : 'border-[var(--color-border)]'
                                                            }`}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDropOnLine(e, line.id)}
                                                    >
                                                        <div className="text-sm font-medium text-[var(--color-text)] mb-2">
                                                            {line.name}
                                                            <span className="text-[var(--color-text-muted)] ml-2">
                                                                ({line.code})
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {lineMembers.length === 0 ? (
                                                                <p className="text-xs text-[var(--color-text-muted)] italic">
                                                                    Drop managers here
                                                                </p>
                                                            ) : (
                                                                lineMembers.map((member) => {
                                                                    const scope = getScopeForLine(member, line.id);
                                                                    return (
                                                                        <div
                                                                            key={member.id}
                                                                            draggable
                                                                            onDragStart={(e) => handleDragStart(e, member)}
                                                                            onDragEnd={handleDragEnd}
                                                                            className="flex items-center justify-between bg-[var(--color-background)] p-2 rounded text-sm cursor-grab active:cursor-grabbing"
                                                                        >
                                                                            <div>
                                                                                <span className="text-[var(--color-text)]">
                                                                                    {member.full_name || member.email}
                                                                                </span>
                                                                            </div>
                                                                            {scope && (
                                                                                <button
                                                                                    onClick={() => handleRemoveScope(member.id, scope.id)}
                                                                                    className="text-red-500 hover:text-red-700 text-xs"
                                                                                    title="Remove from line"
                                                                                >
                                                                                    ✕
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[var(--color-surface)] rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-[var(--color-accent)]">
                            {members.filter((m) => m.role === 'manager').length}
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">Total Managers</div>
                    </div>
                    <div className="bg-[var(--color-surface)] rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-emerald-500">
                            {members.filter((m) => m.role === 'manager' && m.scopes.length > 0).length}
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">Assigned Managers</div>
                    </div>
                    <div className="bg-[var(--color-surface)] rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-amber-500">
                            {unassignedMembers.length}
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">Unassigned Managers</div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default TeamManagementPage;


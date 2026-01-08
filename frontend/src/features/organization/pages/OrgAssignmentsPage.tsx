/**
 * Organization Assignments Page
 * 
 * Visual drag-and-drop tool for assigning managers to production lines.
 * This is the "workbench" in the Hub and Spoke pattern.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    listOrgMembers,
    assignUserToLine,
    removeUserScope,
    type MemberRead,
    type ScopeRead,
} from '../../../api/endpoints/team/teamApi';
import { AXIOS_INSTANCE } from '../../../api/axios-client';
import { ArrowLeft } from 'lucide-react';

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

const OrgAssignmentsPage: React.FC = () => {
    const navigate = useNavigate();

    // State
    const [members, setMembers] = useState<MemberRead[]>([]);
    const [factories, setFactories] = useState<Factory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [draggedMember, setDraggedMember] = useState<MemberRead | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Data Fetching
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [membersRes, factoriesRes] = await Promise.all([
                listOrgMembers(),
                AXIOS_INSTANCE.get('/api/v1/factories'),
            ]);

            setMembers(membersRes.data);

            const factoriesWithLines: Factory[] = await Promise.all(
                factoriesRes.data.map(async (factory: any) => {
                    try {
                        const linesRes = await AXIOS_INSTANCE.get(`/api/v1/factories/${factory.id}/lines`);
                        return { ...factory, production_lines: linesRes.data || [] };
                    } catch {
                        return { ...factory, production_lines: [] };
                    }
                })
            );

            setFactories(factoriesWithLines);
        } catch (err: any) {
            console.error('Failed to fetch data:', err);
            setError(err.response?.data?.detail || 'Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Helpers
    const unassignedMembers = members.filter(
        (m) => m.role === 'manager' && m.scopes.length === 0
    );

    const getMembersForLine = (lineId: string): MemberRead[] => {
        return members.filter((m) =>
            m.scopes.some((s) => s.production_line_id === lineId)
        );
    };

    const getScopeForLine = (member: MemberRead, lineId: string): ScopeRead | undefined => {
        return member.scopes.find((s) => s.production_line_id === lineId);
    };

    // Drag and Drop Handlers
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
            await fetchData();
        } catch (err: any) {
            console.error('Failed to assign user:', err);
            setError(err.response?.data?.detail || 'Failed to assign user');
        } finally {
            setActionLoading(false);
            setDraggedMember(null);
        }
    };

    const handleDropOnUnassigned = async (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedMember || actionLoading) return;

        try {
            setActionLoading(true);
            for (const scope of draggedMember.scopes) {
                await removeUserScope(draggedMember.id, scope.id);
            }
            await fetchData();
        } catch (err: any) {
            console.error('Failed to unassign user:', err);
            setError(err.response?.data?.detail || 'Failed to remove assignment');
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

    // Render
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
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <button
                        onClick={() => navigate('/settings/organization/members')}
                        className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Members
                    </button>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Team Assignments</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">
                        Drag and drop managers to assign them to production lines.
                    </p>
                </div>
            </div>

            {actionLoading && (
                <div className="fixed top-4 right-4 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg shadow-lg z-50">
                    Updating...
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Unassigned Members */}
                <div className="lg:col-span-1">
                    <div
                        className={`bg-[var(--color-surface)] rounded-xl border p-4 min-h-[400px] transition-all ${draggedMember && draggedMember.scopes.length > 0
                                ? 'border-[var(--color-primary)] border-dashed border-2'
                                : 'border-[var(--color-border)]'
                            }`}
                        onDragOver={handleDragOver}
                        onDrop={handleDropOnUnassigned}
                    >
                        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                            Unassigned ({unassignedMembers.length})
                        </h2>
                        <div className="space-y-2">
                            {unassignedMembers.length === 0 ? (
                                <p className="text-[var(--color-text-muted)] text-sm italic">
                                    All managers are assigned.
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
                <div className="lg:col-span-2 space-y-4">
                    {factories.length === 0 ? (
                        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                            <p className="text-[var(--color-text-muted)]">
                                No factories found. Create a factory first.
                            </p>
                        </div>
                    ) : (
                        factories.map((factory) => (
                            <div
                                key={factory.id}
                                className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4"
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
                                        No production lines.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {factory.production_lines?.map((line) => {
                                            const lineMembers = getMembersForLine(line.id);
                                            return (
                                                <div
                                                    key={line.id}
                                                    className={`border rounded-lg p-3 min-h-[100px] transition-all ${draggedMember &&
                                                            !draggedMember.scopes.some(
                                                                (s) => s.production_line_id === line.id
                                                            )
                                                            ? 'border-[var(--color-primary)] border-dashed bg-[var(--color-primary)]/5'
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
                                                                        <span className="text-[var(--color-text)]">
                                                                            {member.full_name || member.email}
                                                                        </span>
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

            {/* Stats Footer */}
            <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4 text-center">
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                        {members.filter((m) => m.role === 'manager').length}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">Total Managers</div>
                </div>
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-500">
                        {members.filter((m) => m.role === 'manager' && m.scopes.length > 0).length}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">Assigned</div>
                </div>
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4 text-center">
                    <div className="text-2xl font-bold text-amber-500">
                        {unassignedMembers.length}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">Unassigned</div>
                </div>
            </div>
        </div>
    );
};

export default OrgAssignmentsPage;

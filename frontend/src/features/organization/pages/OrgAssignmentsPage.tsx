/**
 * Organization Assignments Page
 * 
 * Visual drag-and-drop tool for assigning managers to production lines.
 * Features Edit Mode toggle for layout customization.
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
import { ArrowLeft, Settings, Plus } from 'lucide-react';
import { cn } from '../../../lib/utils';

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

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);

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

    // Drag and Drop Handlers (only active in Assign Mode)
    const handleDragStart = (e: React.DragEvent, member: MemberRead) => {
        if (isEditMode) return;
        setDraggedMember(member);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', member.id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isEditMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnLine = async (e: React.DragEvent, lineId: string) => {
        if (isEditMode) return;
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
        if (isEditMode) return;
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
        if (actionLoading || isEditMode) return;

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
        <div className="h-full flex flex-col">
            {/* Header with Mode Toggle */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-border)]">
                <div>
                    <button
                        onClick={() => navigate('/organization/settings/members')}
                        className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Members
                    </button>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Team Assignments</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">
                        {isEditMode
                            ? 'Customize your factory and line structure.'
                            : 'Drag and drop managers to assign them to production lines.'}
                    </p>
                </div>

                {/* Mode Toggle Button */}
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        isEditMode
                            ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                            : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)]/30"
                    )}
                >
                    <Settings className="w-4 h-4" />
                    {isEditMode ? 'Done Editing' : 'Customize Layout'}
                </button>
            </div>

            {actionLoading && (
                <div className="fixed top-4 right-4 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg shadow-lg z-50">
                    Updating...
                </div>
            )}

            {/* Edit Mode Banner */}
            {isEditMode && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                    <Settings className="w-5 h-5 text-amber-600" />
                    <span className="text-sm text-amber-800">
                        <strong>Edit Mode:</strong> You can add new factories and production lines. User assignments are disabled.
                    </span>
                </div>
            )}

            <div className="flex-1 flex gap-6">
                {/* Left Panel: Unassigned Members (hidden in Edit Mode) */}
                {!isEditMode && (
                    <div className="w-72 shrink-0">
                        <div
                            className={cn(
                                "bg-[var(--color-surface)] rounded-xl border p-4 min-h-[400px] transition-all",
                                draggedMember && draggedMember.scopes.length > 0
                                    ? 'border-[var(--color-primary)] border-dashed border-2'
                                    : 'border-[var(--color-border)]'
                            )}
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
                                            <div className="font-medium text-[var(--color-text)] truncate max-w-[200px]" title={member.full_name || 'Unknown'}>
                                                {member.full_name || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-[var(--color-text-muted)] truncate" title={member.email}>
                                                {member.email}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Right Panel: Factories and Lines Grid */}
                <div className="flex-1">
                    <div className={cn(
                        "grid gap-4",
                        isEditMode ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-2"
                    )}>
                        {factories.length === 0 && !isEditMode ? (
                            <div className="col-span-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                                <p className="text-[var(--color-text-muted)]">
                                    No factories found. Create a factory first.
                                </p>
                            </div>
                        ) : (
                            <>
                                {factories.map((factory) => (
                                    <div
                                        key={factory.id}
                                        className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden"
                                    >
                                        {/* Factory Header */}
                                        <div className="bg-[var(--color-background)] px-4 py-3 border-b border-[var(--color-border)]">
                                            <h2 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                                <span className="truncate max-w-[180px]" title={factory.name}>
                                                    {factory.name}
                                                </span>
                                                <span className="text-xs text-[var(--color-text-muted)] font-normal">
                                                    {factory.code}
                                                </span>
                                            </h2>
                                        </div>

                                        {/* Lines Container */}
                                        <div className="p-3 space-y-2">
                                            {factory.production_lines?.length === 0 ? (
                                                <p className="text-[var(--color-text-muted)] text-sm italic py-4 text-center">
                                                    No production lines configured.
                                                </p>
                                            ) : (
                                                factory.production_lines?.map((line) => {
                                                    const lineMembers = getMembersForLine(line.id);
                                                    return (
                                                        <div
                                                            key={line.id}
                                                            className={cn(
                                                                "border rounded-lg p-3 transition-all",
                                                                !isEditMode && draggedMember && !draggedMember.scopes.some((s) => s.production_line_id === line.id)
                                                                    ? 'border-[var(--color-primary)] border-dashed bg-[var(--color-primary)]/5'
                                                                    : 'border-[var(--color-border)]',
                                                                isEditMode && "opacity-75"
                                                            )}
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDropOnLine(e, line.id)}
                                                        >
                                                            {/* Line Header with Truncation */}
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span
                                                                    className="text-sm font-medium text-[var(--color-text)] truncate max-w-[160px]"
                                                                    title={line.name}
                                                                >
                                                                    {line.name}
                                                                </span>
                                                                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                                                                    [{line.code}]
                                                                </span>
                                                            </div>

                                                            {/* Assigned Members */}
                                                            <div className="space-y-1">
                                                                {lineMembers.length === 0 ? (
                                                                    <p className="text-xs text-[var(--color-text-muted)] italic">
                                                                        {isEditMode ? 'No managers assigned' : 'Drop managers here'}
                                                                    </p>
                                                                ) : (
                                                                    lineMembers.map((member) => {
                                                                        const scope = getScopeForLine(member, line.id);
                                                                        return (
                                                                            <div
                                                                                key={member.id}
                                                                                draggable={!isEditMode}
                                                                                onDragStart={(e) => handleDragStart(e, member)}
                                                                                onDragEnd={handleDragEnd}
                                                                                className={cn(
                                                                                    "flex items-center justify-between bg-[var(--color-background)] p-2 rounded text-sm",
                                                                                    !isEditMode && "cursor-grab active:cursor-grabbing",
                                                                                    isEditMode && "opacity-50"
                                                                                )}
                                                                            >
                                                                                <span
                                                                                    className="text-[var(--color-text)] truncate max-w-[120px]"
                                                                                    title={member.full_name || member.email}
                                                                                >
                                                                                    {member.full_name || member.email}
                                                                                </span>
                                                                                {scope && !isEditMode && (
                                                                                    <button
                                                                                        onClick={() => handleRemoveScope(member.id, scope.id)}
                                                                                        className="text-red-500 hover:text-red-700 text-xs shrink-0"
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
                                                })
                                            )}

                                            {/* Add Line Button (Edit Mode Only) */}
                                            {isEditMode && (
                                                <button
                                                    className="w-full border-2 border-dashed border-[var(--color-border)] p-3 text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                                    onClick={() => {
                                                        // TODO: Implement add line modal
                                                        alert('Add Line feature coming soon!');
                                                    }}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add Production Line
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Add Factory Card (Edit Mode Only) */}
                                {isEditMode && (
                                    <button
                                        className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                                        onClick={() => {
                                            // TODO: Implement add factory modal
                                            alert('Add Factory feature coming soon!');
                                        }}
                                    >
                                        <Plus className="w-8 h-8" />
                                        <span className="text-sm font-medium">Add Factory</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Footer (hidden in Edit Mode) */}
            {!isEditMode && (
                <div className="mt-6 pt-4 border-t border-[var(--color-border)] grid grid-cols-3 gap-4">
                    <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-3 text-center">
                        <div className="text-xl font-bold text-[var(--color-primary)]">
                            {members.filter((m) => m.role === 'manager').length}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Total Managers</div>
                    </div>
                    <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-3 text-center">
                        <div className="text-xl font-bold text-emerald-500">
                            {members.filter((m) => m.role === 'manager' && m.scopes.length > 0).length}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Assigned</div>
                    </div>
                    <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-3 text-center">
                        <div className="text-xl font-bold text-amber-500">
                            {unassignedMembers.length}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">Unassigned</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrgAssignmentsPage;

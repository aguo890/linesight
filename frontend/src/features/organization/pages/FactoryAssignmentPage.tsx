/**
 * Factory Assignment Page (Workbench)
 * 
 * Per-factory drag-and-drop interface for assigning managers to production lines.
 * Accessed via drill-down from FactorySelectionPage.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    listOrgMembers,
    assignUserToLine,
    removeUserScope,
    type MemberRead,
    type ScopeRead,
} from '../../../api/endpoints/team/teamApi';
import { AXIOS_INSTANCE } from '../../../api/axios-client';
import { ArrowLeft, Users, Layers } from 'lucide-react';
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
}

const FactoryAssignmentPage: React.FC = () => {
    const navigate = useNavigate();
    const { factoryId } = useParams<{ factoryId: string }>();

    // State
    const [factory, setFactory] = useState<Factory | null>(null);
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [members, setMembers] = useState<MemberRead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [draggedMember, setDraggedMember] = useState<MemberRead | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Data Fetching
    const fetchData = useCallback(async () => {
        if (!factoryId) return;

        try {
            setLoading(true);
            setError(null);

            const [factoryRes, linesRes, membersRes] = await Promise.all([
                AXIOS_INSTANCE.get(`/api/v1/factories/${factoryId}`),
                AXIOS_INSTANCE.get(`/api/v1/factories/${factoryId}/lines`),
                listOrgMembers(),
            ]);

            setFactory(factoryRes.data);
            setLines(linesRes.data || []);
            setMembers(membersRes.data);
        } catch (err: any) {
            console.error('Failed to fetch data:', err);
            setError(err.response?.data?.detail || 'Failed to load factory data.');
        } finally {
            setLoading(false);
        }
    }, [factoryId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Get managers for this factory (assigned to any of its lines)

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

    if (error || !factory) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="bg-red-50 p-6 rounded-xl text-center">
                    <p className="text-red-600 mb-4">{error || 'Factory not found'}</p>
                    <button
                        onClick={() => navigate('/organization/settings/assignments')}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                        Back to Factories
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header with Breadcrumb */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-border)]">
                <div>
                    <Link
                        to="/organization/settings/assignments"
                        className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Factories
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-[var(--color-text)]">{factory.name}</h1>
                        <span className="text-sm font-mono bg-[var(--color-background)] text-[var(--color-text-muted)] px-2 py-1 rounded border border-[var(--color-border)]">
                            {factory.code}
                        </span>
                    </div>
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

            {/* Main Content: Flex Layout */}
            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Left: Production Lines Canvas */}
                <div className="flex-1 overflow-auto">
                    {lines.length === 0 ? (
                        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                            <Layers className="w-12 h-12 text-[var(--color-text-subtle)] mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">No Production Lines</h3>
                            <p className="text-[var(--color-text-muted)]">
                                This factory doesn't have any production lines yet.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {lines.map((line) => {
                                const lineMembers = getMembersForLine(line.id);
                                const isDropTarget = draggedMember && !draggedMember.scopes.some((s) => s.production_line_id === line.id);

                                return (
                                    <div
                                        key={line.id}
                                        className={cn(
                                            "bg-[var(--color-surface)] rounded-xl border p-4 min-h-[150px] transition-all",
                                            isDropTarget
                                                ? 'border-[var(--color-primary)] border-dashed border-2 bg-[var(--color-primary)]/5'
                                                : 'border-[var(--color-border)]'
                                        )}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropOnLine(e, line.id)}
                                    >
                                        {/* Line Header */}
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-border)]">
                                            <h3 className="font-semibold text-[var(--color-text)]" title={line.name}>
                                                {line.name}
                                            </h3>
                                            <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-background)] px-2 py-0.5 rounded">
                                                {line.code}
                                            </span>
                                        </div>

                                        {/* Assigned Managers */}
                                        <div className="space-y-2">
                                            {lineMembers.length === 0 ? (
                                                <p className="text-sm text-[var(--color-text-muted)] italic py-4 text-center">
                                                    Drop managers here to assign
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
                                                            className="flex items-center justify-between bg-[var(--color-background)] p-2.5 rounded-lg cursor-grab active:cursor-grabbing border border-[var(--color-border)] hover:shadow-sm transition-shadow"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-[var(--color-text)] text-sm truncate" title={member.full_name || member.email}>
                                                                    {member.full_name || 'Unknown'}
                                                                </div>
                                                                <div className="text-xs text-[var(--color-text-muted)] truncate" title={member.email}>
                                                                    {member.email}
                                                                </div>
                                                            </div>
                                                            {scope && (
                                                                <button
                                                                    onClick={() => handleRemoveScope(member.id, scope.id)}
                                                                    className="ml-2 text-red-500 hover:text-red-700 text-xs shrink-0 p-1"
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

                {/* Right: Unassigned Managers Drawer */}
                <div className="w-72 shrink-0 flex flex-col">
                    <div
                        className={cn(
                            "flex-1 bg-[var(--color-surface)] rounded-xl border overflow-hidden flex flex-col transition-all",
                            draggedMember && draggedMember.scopes.length > 0
                                ? 'border-[var(--color-primary)] border-dashed border-2'
                                : 'border-[var(--color-border)]'
                        )}
                        onDragOver={handleDragOver}
                        onDrop={handleDropOnUnassigned}
                    >
                        {/* Drawer Header */}
                        <div className="p-4 bg-[var(--color-background)] border-b border-[var(--color-border)]">
                            <h3 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Available Managers
                            </h3>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                Drag to assign to a line
                            </p>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-auto p-3 space-y-2">
                            {unassignedMembers.length === 0 ? (
                                <p className="text-sm text-[var(--color-text-muted)] italic text-center py-8">
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
                                        <div className="font-medium text-[var(--color-text)] text-sm truncate" title={member.full_name || 'Unknown'}>
                                            {member.full_name || 'Unknown'}
                                        </div>
                                        <div className="text-xs text-[var(--color-text-muted)] truncate" title={member.email}>
                                            {member.email}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Drawer Footer Stats */}
                        <div className="p-3 bg-[var(--color-background)] border-t border-[var(--color-border)] text-center">
                            <span className="text-xs text-[var(--color-text-muted)]">
                                {unassignedMembers.length} unassigned
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FactoryAssignmentPage;

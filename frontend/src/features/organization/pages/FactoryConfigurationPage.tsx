/**
 * Factory Configuration Workbench
 * 
 * The central hub for configuring a specific factory.
 * modes:
 * 1. Assignments (Default): Drag-and-drop managers to lines.
 * 2. Structure (Edit Mode): Add/Rename/Delete production lines.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    listOrgMembers,
    assignUserToLine,
    removeUserScope,
    type MemberRead,
    type ScopeRead,
} from '../../../api/endpoints/team/teamApi';
import {
    useGetFactoryApiV1FactoriesFactoryIdGet,
    deleteProductionLineApiV1FactoriesLinesLineIdDelete,
    updateProductionLineApiV1FactoriesLinesLineIdPatch
} from '../../../api/endpoints/factories/factories';
import { ArrowLeft, Settings, Plus, LayoutGrid, Users, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { CreateLineModal } from '../components/CreateLineModal';
import { useOrganization } from '../../../contexts/OrganizationContext';

// Types


export const FactoryConfigurationPage: React.FC = () => {
    const { factoryId } = useParams<{ factoryId: string }>();
    const navigate = useNavigate();
    const { quotaStatus, refreshQuota } = useOrganization();

    // State
    const [members, setMembers] = useState<MemberRead[]>([]);
    const [draggedMember, setDraggedMember] = useState<MemberRead | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [lineActionLoading, setLineActionLoading] = useState<string | null>(null);
    const [isCreateLineModalOpen, setIsCreateLineModalOpen] = useState(false);

    // Edit Mode State: false = Assignments, true = Structure
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('factoryConfig.isSidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });

    // Persist Sidebar State
    useEffect(() => {
        localStorage.setItem('factoryConfig.isSidebarOpen', JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen]);

    // Data Fetching
    const {
        data: factoryData,
        isLoading: loadingFactory,
        error: factoryError,
        refetch: refetchFactory
    } = useGetFactoryApiV1FactoriesFactoryIdGet(factoryId || '', {
        query: { enabled: !!factoryId }
    });

    const fetchMembers = useCallback(async () => {
        try {
            const res = await listOrgMembers();
            setMembers(res.data);
        } catch (err) {
            console.error('Failed to fetch members:', err);
        }
    }, []);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

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
            await fetchMembers(); // Refresh assignments
        } catch (err: any) {
            console.error('Failed to assign user:', err);
            alert('Failed to assign user');
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
            await fetchMembers();
        } catch (err: any) {
            console.error('Failed to unassign user:', err);
            alert('Failed to remove assignment');
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
        if (!confirm('Remove this manager from the line?')) return;

        try {
            setActionLoading(true);
            await removeUserScope(memberId, scopeId);
            await fetchMembers();
        } catch (err: any) {
            console.error('Failed to remove scope:', err);
            alert('Failed to remove assignment');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLineCreated = () => {
        setIsCreateLineModalOpen(false);
        refreshQuota(); // Refresh quota after line creation
        refetchFactory();
    };

    const handleRenameLine = async (lineId: string, currentName: string) => {
        const newName = window.prompt("Enter new name for production line:", currentName);
        if (!newName || newName === currentName) return;

        try {
            setLineActionLoading(lineId);
            await updateProductionLineApiV1FactoriesLinesLineIdPatch(lineId, { name: newName });
            await refetchFactory();
        } catch (err) {
            console.error('Failed to rename line:', err);
            alert('Failed to rename line. Please try again.');
        } finally {
            setLineActionLoading(null);
        }
    };

    const handleDeleteLine = async (lineId: string, lineName: string) => {
        if (!confirm(`Are you sure you want to delete "${lineName}"? This cannot be undone.`)) return;

        try {
            setLineActionLoading(lineId);
            await deleteProductionLineApiV1FactoriesLinesLineIdDelete(lineId);
            await Promise.all([
                refetchFactory(),
                refreshQuota()
            ]);
        } catch (err) {
            console.error('Failed to delete line:', err);
            alert('Failed to delete line. It may have associated data.');
        } finally {
            setLineActionLoading(null);
        }
    };

    // Render
    if (loadingFactory) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        );
    }

    if (factoryError || !factoryData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <div className="bg-red-50 p-6 rounded-xl text-center">
                    <p className="text-red-600 mb-4">Failed to load factory configuration.</p>
                    <button
                        onClick={() => navigate('/organization/settings/factories')}
                        className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        Back to Factories
                    </button>
                </div>
            </div>
        );
    }

    const factory = factoryData;

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            {/* Header */}
            <div className="bg-white border-b border-[var(--color-border)] px-8 py-5 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/organization/settings/factories')}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        title="Back to Factories"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="h-6 w-px bg-[var(--color-border)]" />
                    <div>
                        <h1 className="text-xl font-bold text-[var(--color-text)] flex items-center gap-2">
                            {factory.name}
                            <span className="text-sm font-normal text-[var(--color-text-muted)] px-2 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md font-mono">
                                {factory.code}
                            </span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-[var(--color-text-muted)] mr-2 hidden md:inline">
                        {isEditMode ? 'Editing Structure' : 'Managing Assignments'}
                    </span>
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm",
                            isEditMode
                                ? "bg-[var(--color-primary)] text-white ring-2 ring-[var(--color-primary)] ring-offset-2"
                                : "bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                        )}
                    >
                        {isEditMode ? (
                            <>
                                <Settings className="w-4 h-4" />
                                Done Editing
                            </>
                        ) : (
                            <>
                                <LayoutGrid className="w-4 h-4" />
                                Customize Layout
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">

                {/* Left Sidebar: Unassigned Members (Only in Assignment Mode) */}
                {!isEditMode && (
                    <div className={cn(
                        "relative flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-300 ease-in-out",
                        isSidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden border-r-0"
                    )}>
                        {/* Sidebar Content */}
                        <div className="flex-1 overflow-y-auto p-6 min-w-[20rem]">
                            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Unassigned Managers
                            </h3>

                            <div
                                className={cn(
                                    "space-y-3 min-h-[200px] transition-all rounded-xl p-2",
                                    draggedMember && "bg-[var(--color-background)] border-2 border-dashed border-[var(--color-primary)]/20"
                                )}
                                onDragOver={handleDragOver}
                                onDrop={handleDropOnUnassigned}
                            >
                                {unassignedMembers.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)] italic text-center py-8">
                                        All managers assigned.
                                    </p>
                                ) : (
                                    unassignedMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, member)}
                                            onDragEnd={handleDragEnd}
                                            className="bg-white p-3 rounded-lg border border-[var(--color-border)] shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all group"
                                        >
                                            <div className="font-medium text-[var(--color-text)] truncate">
                                                {member.full_name || member.email?.split('@')[0]}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-muted)] truncate">
                                                {member.email}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Collapsible Toggle Tab (Outside Sidebar) */}
                {!isEditMode && (
                    <div className="relative z-20 flex flex-col justify-center">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="bg-white border border-[var(--color-border)] border-l-0 rounded-r-lg p-1 shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)] transition-colors h-12 flex items-center justify-center -ml-[1px]"
                            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Managers"}
                        >
                            {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                )}

                {/* Main Area: Production Lines */}
                <div className={cn(
                    "flex-1 overflow-y-auto bg-[var(--color-background)]",
                    isEditMode && "p-8"
                )}>
                    <div className="max-w-4xl mx-auto p-6">

                        {/* Edit Mode Header / Actions */}
                        {isEditMode && (
                            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                <button
                                    onClick={() => setIsCreateLineModalOpen(true)}
                                    className="w-full border-2 border-dashed border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all group"
                                >
                                    <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                        <Plus className="w-6 h-6" />
                                    </div>
                                    <span className="font-medium">Add New Production Line</span>
                                </button>
                            </div>
                        )}

                        {/* Production Lines List */}
                        <div className="space-y-4">
                            {factory.production_lines?.length === 0 && !isEditMode ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-[var(--color-border)]">
                                    <LayoutGrid className="w-12 h-12 text-[var(--color-text-subtle)] mx-auto mb-3" />
                                    <h3 className="text-lg font-medium text-[var(--color-text)]">No Production Lines</h3>
                                    <p className="text-[var(--color-text-muted)] mb-4">
                                        This factory has no active lines.
                                    </p>
                                    <button
                                        onClick={() => setIsEditMode(true)}
                                        className="text-[var(--color-primary)] font-medium hover:underline"
                                    >
                                        Enable Edit Mode to add lines &rarr;
                                    </button>
                                </div>
                            ) : (
                                factory.production_lines?.map((line) => {
                                    const lineMembers = getMembersForLine(line.id);
                                    const isUpdating = lineActionLoading === line.id;

                                    return (
                                        <div
                                            key={line.id}
                                            className={cn(
                                                "bg-white rounded-xl border transition-all overflow-hidden relative",
                                                !isEditMode && draggedMember
                                                    ? "border-[var(--color-primary)] border-dashed ring-4 ring-[var(--color-primary)]/5"
                                                    : "border-[var(--color-border)] shadow-sm",
                                                !isEditMode && "hover:border-[var(--color-primary)]/30",
                                                isUpdating && "opacity-70 pointer-events-none"
                                            )}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDropOnLine(e, line.id)}
                                        >
                                            {isUpdating && (
                                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                                                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                                                </div>
                                            )}

                                            <div className="p-5 flex items-start justify-between gap-4">
                                                {/* Left: Line Info */}
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="text-lg font-semibold text-[var(--color-text)]">
                                                            {line.name}
                                                        </h3>
                                                        <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                                                            {line.code}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-[var(--color-text-muted)]">
                                                        {lineMembers.length} {lineMembers.length === 1 ? 'Manager' : 'Managers'} Assigned
                                                    </p>
                                                </div>

                                                {/* Right: Actions (Edit Mode) or Facepile (Assign Mode) */}
                                                <div>
                                                    {isEditMode ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)] rounded-lg transition-colors border border-transparent hover:border-[var(--color-border)]"
                                                                title="Rename Line"
                                                                onClick={() => handleRenameLine(line.id, line.name)}
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                className="p-2 text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                title="Delete Line"
                                                                onClick={() => handleDeleteLine(line.id, line.name)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex -space-x-2 overflow-hidden">
                                                            {lineMembers.map(member => (
                                                                <div
                                                                    key={member.id}
                                                                    className="relative group cursor-pointer"
                                                                    title={member.full_name || member.email}
                                                                    onClick={() => handleRemoveScope(member.id, getScopeForLine(member, line.id)?.id || '')}
                                                                >
                                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-indigo-50 text-xs font-medium text-indigo-700 hover:scale-105 transition-transform">
                                                                        {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="absolute inset-0 rounded-full ring-2 ring-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-white/80 transition-opacity">
                                                                        <span className="text-red-600 font-bold">×</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {lineMembers.length === 0 && (
                                                                <div className="h-10 w-10 rounded-full border-2 border-dashed border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
                                                                    <Plus className="w-4 h-4" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Drop Zone Hint (Assignment Mode) */}
                                            {!isEditMode && draggedMember && (
                                                <div className="bg-[var(--color-primary)]/5 border-t border-dashed border-[var(--color-primary)] p-2 text-center text-xs font-medium text-[var(--color-primary)]">
                                                    Drop here to assign
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <CreateLineModal
                isOpen={isCreateLineModalOpen}
                onClose={() => setIsCreateLineModalOpen(false)}
                factoryId={factoryId || ''}
                factoryName={factory.name}
                quotaStatus={quotaStatus}
                onSuccess={handleLineCreated}
            />
        </div>
    );
};

export default FactoryConfigurationPage;

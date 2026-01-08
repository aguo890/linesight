/**
 * Factory Configuration Workbench
 * 
 * The central hub for configuring a specific factory.
 * Implements "Hybrid List" design:
 * - Clean rows with inline actions
 * - Bulk selection bar for assignments
 * - detailed structure editing
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Settings, LayoutGrid, Users, X, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';

// Custom Components
import { ProductionLineRow } from '../components/ProductionLineRow';
import { CreateLineModal } from '../components/CreateLineModal';
import { UserSearchCommand } from '../components/UserSearchCommand';

// API & Context
import { useGetFactoryApiV1FactoriesFactoryIdGet } from '../../../api/endpoints/factories/factories';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { assignUserToLine, listOrgMembers } from '../../../api/endpoints/team/teamApi';

export const FactoryConfigurationPage: React.FC = () => {
    const { factoryId } = useParams<{ factoryId: string }>();
    const navigate = useNavigate();
    const { quotaStatus, refreshQuota } = useOrganization();

    // Data State
    const [members, setMembers] = useState<any[]>([]); // Typed as MemberRead

    // UI State
    const [isEditMode, setIsEditMode] = useState(false);
    const [isCreateLineModalOpen, setIsCreateLineModalOpen] = useState(false);
    const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);

    // Controlled Popover State
    const [activePopoverLineId, setActivePopoverLineId] = useState<string | null>(null);

    // Bulk Selection State
    const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

    // Fetch Logic
    const { data: factory, refetch: refetchFactory, isLoading } = useGetFactoryApiV1FactoriesFactoryIdGet(factoryId || '', {
        query: { enabled: !!factoryId }
    });

    const fetchMembers = useCallback(async () => {
        const res = await listOrgMembers();
        setMembers(res.data);
    }, []);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    // --- Handlers ---

    // Toggle Selection for Bulk Actions
    const toggleLineSelection = (lineId: string) => {
        const newSet = new Set(selectedLineIds);
        if (newSet.has(lineId)) newSet.delete(lineId);
        else newSet.add(lineId);
        setSelectedLineIds(newSet);
    };

    // Unified Assignment Logic (Single or Bulk)
    const handleAssignUser = async (userId: string, targetLineIds: string[]) => {
        try {
            // In a real app, optimize this with a bulk API endpoint
            await Promise.all(targetLineIds.map(id =>
                assignUserToLine(userId, { production_line_id: id, role: 'manager' })
            ));
            await fetchMembers(); // Refresh to show new avatars

            // Reset UI
            setSelectedLineIds(new Set());
            setIsBulkAssignOpen(false);
        } catch (err) {
            console.error("Assignment failed", err);
            alert("Failed to assign manager.");
        }
    };

    if (isLoading || !factory) return <div className="p-8">Loading Factory...</div>;

    return (
        <div className="h-full flex flex-col bg-gray-50 relative">
            {/* Header */}
            <div className="bg-white border-b px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link to="/organization/settings/factories" className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        {factory.name}
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded border">
                            {factory.code}
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 hidden md:inline">
                        {isEditMode ? 'Structure Mode' : 'Assignment Mode'}
                    </span>
                    <Button
                        variant={isEditMode ? "default" : "outline"}
                        onClick={() => {
                            setIsEditMode(!isEditMode);
                            setSelectedLineIds(new Set()); // Clear selection on mode switch
                        }}
                        className="gap-2"
                    >
                        {isEditMode ? <Settings className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                        {isEditMode ? 'Done Editing' : 'Customize Layout'}
                    </Button>
                </div>
            </div>

            {/* Main Content Area - No Sidebar! */}
            <div className="flex-1 overflow-y-auto p-8 pb-32">
                <div className="max-w-5xl mx-auto">

                    {/* Add Line Button (Only in Edit Mode) */}
                    {isEditMode && (
                        <button
                            onClick={() => setIsCreateLineModalOpen(true)}
                            className="w-full mb-6 border-2 border-dashed border-gray-300 rounded-xl p-6 flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            <span className="font-bold flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Add Production Line
                            </span>
                        </button>
                    )}

                    {/* The List of Rows */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y">
                        {factory.production_lines?.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">No lines configured. Switch to Edit Mode to add one.</div>
                        ) : (
                            factory.production_lines?.map((line) => {
                                // Calculate assigned users for this line
                                const assignedUsers = members.filter(m =>
                                    m.scopes.some((s: any) => s.production_line_id === line.id)
                                );

                                return (
                                    <ProductionLineRow
                                        key={line.id}
                                        line={line}
                                        assignedUsers={assignedUsers}
                                        isEditMode={isEditMode}
                                        isSelected={selectedLineIds.has(line.id)}
                                        isSearchOpen={activePopoverLineId === line.id}
                                        onToggleSearch={(isOpen: boolean) => setActivePopoverLineId(isOpen ? line.id : null)}
                                        onToggleSelection={() => toggleLineSelection(line.id)}
                                        onAssignUser={(userId: string) => handleAssignUser(userId, [line.id])}
                                        onRefetchRequest={refetchFactory} // For renames/deletes
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* FLOATING ACTION BAR (Bulk Actions) */}
            {selectedLineIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="bg-gray-900 text-white shadow-2xl rounded-full px-6 py-3 flex items-center gap-6">
                        <div className="flex items-center gap-2 border-r border-gray-700 pr-6">
                            <div className="bg-white text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {selectedLineIds.size}
                            </div>
                            <span className="text-sm font-medium">Selected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Popover open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" className="text-white hover:bg-gray-800 h-8 gap-2">
                                        <Users className="w-4 h-4" />
                                        Assign Manager
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-64 mb-2" side="top">
                                    <UserSearchCommand
                                        users={members}
                                        onSelect={(userId) => handleAssignUser(userId, Array.from(selectedLineIds))}
                                        onClose={() => setIsBulkAssignOpen(false)}
                                        inline={true}
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
                                onClick={() => setSelectedLineIds(new Set())}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <CreateLineModal
                isOpen={isCreateLineModalOpen}
                onClose={() => setIsCreateLineModalOpen(false)}
                factoryId={factoryId || ''}
                factoryName={factory.name}
                quotaStatus={quotaStatus}
                onSuccess={() => {
                    setIsCreateLineModalOpen(false);
                    refreshQuota();
                    refetchFactory();
                }}
            />
        </div>
    );
};

export default FactoryConfigurationPage;

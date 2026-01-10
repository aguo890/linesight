import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, LayoutGrid, Users, X, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';

// Custom Components
import { DataSourceRow } from '../components/DataSourceRow';
import { CreateDataSourceModal } from '../components/CreateDataSourceModal';
import { UserSearchCommand } from '../components/UserSearchCommand';
import { DataSourceDetailsDrawer } from '../components/DataSourceDetailsDrawer';
import { MemberDetailsDrawer } from '../components/MemberDetailsDrawer';

// API & Types
import { useGetFactoryApiV1FactoriesFactoryIdGet } from '../../../api/endpoints/factories/factories';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { assignUserToDataSource, listOrgMembers, type MemberRead } from '../../../api/endpoints/team/teamApi';
import type { DataSourceRead as DataSource } from '../../../api/model';

export const FactoryConfigurationPage: React.FC = () => {
    const { factoryId } = useParams<{ factoryId: string }>();
    const navigate = useNavigate();
    const { quotaStatus, refreshQuota } = useOrganization();

    // Data State
    const [members, setMembers] = useState<MemberRead[]>([]);

    // UI State
    const [isEditMode, setIsEditMode] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);

    // Controlled Popover State
    const [activePopoverDataSourceId, setActivePopoverDataSourceId] = useState<string | null>(null);

    // Inspector State
    const [inspectingDataSource, setInspectingDataSource] = useState<DataSource | null>(null);
    const [inspectingMember, setInspectingMember] = useState<MemberRead | null>(null);

    // Bulk Selection State
    const [selectedDataSourceIds, setSelectedDataSourceIds] = useState<Set<string>>(new Set());

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
    const toggleSelection = (dsId: string) => {
        const newSet = new Set(selectedDataSourceIds);
        if (newSet.has(dsId)) newSet.delete(dsId);
        else newSet.add(dsId);
        setSelectedDataSourceIds(newSet);
    };

    // Unified Assignment Logic (Single or Bulk)
    const handleAssignUser = async (userId: string, targetIds: string[]) => {
        try {
            await Promise.all(targetIds.map(id =>
                assignUserToDataSource(userId, { data_source_id: id, role: 'manager' })
            ));
            await fetchMembers(); // Refresh to show new avatars

            // Reset UI
            setSelectedDataSourceIds(new Set());
            setIsBulkAssignOpen(false);
        } catch (err) {
            console.error("Assignment failed", err);
            alert("Failed to assign manager.");
        }
    };

    if (isLoading || !factory) return <div className="p-8">Loading Factory...</div>;

    // Use data_sources from factory response
    const dataSources = factory.data_sources || [];

    return (
        <div className="h-full flex flex-col bg-gray-50 relative">
            {/* Header */}
            <div className="bg-white border-b px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex flex-col gap-2">
                    {/* Breadcrumbs */}
                    <Breadcrumb
                        items={[
                            { label: 'Organization', href: '/organization/settings' },
                            { label: 'Factories', href: '/organization/settings/factories' },
                            { label: factory.name }
                        ]}
                    />

                    <h1 className="text-xl font-bold flex items-center gap-2 mt-1">
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
                            setSelectedDataSourceIds(new Set()); // Clear selection on mode switch
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
                <div className="w-full">

                    {/* Add Data Source Button (Only in Edit Mode) */}
                    {isEditMode && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full mb-6 border-2 border-dashed border-gray-300 rounded-xl p-6 flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            <span className="font-bold flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Add Data Source
                            </span>
                        </button>
                    )}

                    {/* The List of Rows */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y">
                        {dataSources.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">No data sources configured. Switch to Edit Mode to add one.</div>
                        ) : (
                            dataSources.map((ds) => {
                                // Calculate assigned users for this source
                                const assignedUsers = members.filter(m =>
                                    (m.scopes || []).some(s => s.data_source_id === ds.id)
                                );

                                return (
                                    <DataSourceRow
                                        key={ds.id}
                                        dataSource={ds}
                                        assignedUsers={assignedUsers}
                                        isEditMode={isEditMode}
                                        isSelected={selectedDataSourceIds.has(ds.id)}
                                        isSearchOpen={activePopoverDataSourceId === ds.id}
                                        onToggleSearch={(isOpen: boolean) => setActivePopoverDataSourceId(isOpen ? ds.id : null)}
                                        onToggleSelection={() => toggleSelection(ds.id)}
                                        onAssignUser={(userId: string) => handleAssignUser(userId, [ds.id])}
                                        onRefetchRequest={refetchFactory} // For renames/deletes
                                        onClickName={() => setInspectingDataSource(ds)}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* FLOATING ACTION BAR (Bulk Actions) */}
            {selectedDataSourceIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="bg-gray-900 text-white shadow-2xl rounded-full px-6 py-3 flex items-center gap-6">
                        <div className="flex items-center gap-2 border-r border-gray-700 pr-6">
                            <div className="bg-white text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {selectedDataSourceIds.size}
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
                                        onSelect={(userId) => handleAssignUser(userId, Array.from(selectedDataSourceIds))}
                                        onClose={() => setIsBulkAssignOpen(false)}
                                        inline={true}
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
                                onClick={() => setSelectedDataSourceIds(new Set())}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* [NEW] Data Source Inspector Drawer */}
            <DataSourceDetailsDrawer
                dataSource={inspectingDataSource}
                isOpen={!!inspectingDataSource}
                onClose={() => setInspectingDataSource(null)}
                allMembers={members} // Pass full list to filter inside
                onDataChange={() => {
                    refetchFactory();
                    fetchMembers();
                }}
                onMemberClick={(member) => setInspectingMember(member)}
            />

            {/* 2. Member Inspector (Modal on top of Drawer) */}
            <MemberDetailsDrawer
                member={inspectingMember}
                isOpen={!!inspectingMember}
                onClose={() => setInspectingMember(null)}
                displayMode="modal" // Forces centered modal
                contextLines={[]} // TODO: Pass assignments logic if needed
            />

            <CreateDataSourceModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                factoryId={factoryId || ''}
                factoryName={factory.name}
                quotaStatus={quotaStatus}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    refreshQuota();
                    refetchFactory();
                }}
            />
        </div>
    );
};

export default FactoryConfigurationPage;

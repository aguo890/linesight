import React, { useState } from 'react';
import { Checkbox } from '../../../components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { UserSearchCommand } from './UserSearchCommand';
import { useUpdateDataSourceApiV1DatasourcesDataSourceIdPut, useDeleteDataSourceApiV1DatasourcesDataSourceIdDelete } from '../../../api/endpoints/data-sources/data-sources';
import { listOrgMembers } from '../../../api/endpoints/team/teamApi';
import type { DataSourceRead as DataSource } from '../../../api/model';

interface DataSourceRowProps {
    dataSource: DataSource;
    assignedUsers: any[]; // types need cleanup later, matching existing usage
    isEditMode: boolean;
    isSelected: boolean;
    onToggleSelection: (checked: boolean) => void;
    onAssignUser: (userId: string) => void;
    onRefetchRequest: () => void;
    isSearchOpen: boolean;
    onToggleSearch: (isOpen: boolean) => void;
    onClickName: () => void;
}

export const DataSourceRow = ({
    dataSource,
    assignedUsers,
    isEditMode,
    isSelected,
    onToggleSelection,
    onAssignUser,
    onRefetchRequest,
    isSearchOpen,
    onToggleSearch,
    onClickName
}: DataSourceRowProps) => {
    const [allUsers, setAllUsers] = useState<any[]>([]);

    const updateDataSource = useUpdateDataSourceApiV1DatasourcesDataSourceIdPut();
    const deleteDataSource = useDeleteDataSourceApiV1DatasourcesDataSourceIdDelete();

    const loadUsers = async () => {
        const res = await listOrgMembers();
        setAllUsers(res.data);
    };

    // --- Structure Mode Handlers ---
    const handleRename = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newName = prompt("Rename data source:", dataSource.name);
        if (newName && newName !== dataSource.name) {
            // Using PUT with partial data (Orval generated PUT for update)
            await updateDataSource.mutateAsync({
                dataSourceId: dataSource.id,
                data: { name: newName }
            });
            onRefetchRequest();
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Delete ${dataSource.name}?`)) {
            await deleteDataSource.mutateAsync({ dataSourceId: dataSource.id });
            onRefetchRequest();
        }
    };

    return (
        <div
            onClick={onClickName}
            className={`
                group flex items-center justify-between p-4 transition-colors first:rounded-t-xl last:rounded-b-xl cursor-pointer
                ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}
            `}
        >
            {/* LEFT: Checkbox + Name */}
            <div className="flex items-center gap-4 w-1/3">
                {/* Checkbox only appears in Assignment Mode */}
                {!isEditMode && (
                    <div
                        className="w-5 h-5 flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={onToggleSelection}
                            className={`transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        />
                    </div>
                )}
                <div className="group/name flex flex-col">
                    <h4
                        className={`
                            font-medium text-sm truncate transition-all cursor-pointer underline-offset-2
                            ${(/^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name)) ? 'text-gray-400 italic' : 'text-gray-900 group-hover/name:text-blue-600 group-hover/name:underline'}
                        `}
                        title="Click to view details & rename"
                    >
                        {(/^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name)) ? "Untitled Source" : dataSource.name}
                    </h4>
                    <span
                        className="text-[10px] text-gray-400 font-mono mt-0.5 group-hover/name:text-blue-500 transition-colors"
                    >
                        ID: {dataSource.id.split('-').pop()}
                        {(/^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name)) && <span className="ml-1 text-orange-400">• Rename Required</span>}
                    </span>
                </div>
            </div>

            {/* RIGHT: Context-Aware Actions */}
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>

                {/* MODE A: Structure Editing */}
                {isEditMode ? (
                    <div className="flex items-center gap-2">
                        <button onClick={handleRename} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    /* MODE B: Assignments (Facepile + Add Button) */
                    <div className="flex items-center gap-3">
                        {/* Facepile */}
                        <div className="flex -space-x-2">
                            {assignedUsers.map((u: any) => (
                                <Avatar key={u.id} className="w-8 h-8 border-2 border-white ring-1 ring-gray-100" title={u.full_name}>
                                    {/* src is likely undefined, checking types tells us MemberRead has no avatar_url. Avatar component handles missing src safely now. */}
                                    <AvatarImage src={(u as any).avatar_url} />
                                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                        {(u.full_name || u.email || '?').substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                        </div>

                        {/* Quick Assign Button (Popover) */}
                        <Popover open={isSearchOpen} onOpenChange={(open) => {
                            onToggleSearch(open);
                            if (open && allUsers.length === 0) loadUsers();
                        }}>
                            <PopoverTrigger asChild>
                                <button className="h-8 w-8 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-64" side="left">
                                <UserSearchCommand
                                    users={allUsers}
                                    onSelect={(uid) => {
                                        onAssignUser(uid);
                                        onToggleSearch(false);
                                    }}
                                    onClose={() => onToggleSearch(false)}
                                    inline={true}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </div>
        </div>
    );
};

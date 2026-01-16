import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../../components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { UserSearchCommand } from './UserSearchCommand';
import { useUpdateDataSourceApiV1DataSourcesDataSourceIdPut, useDeleteDataSourceApiV1DataSourcesDataSourceIdDelete } from '../../../api/endpoints/data-sources/data-sources';
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
    const { t } = useTranslation();
    const [allUsers, setAllUsers] = useState<any[]>([]);

    const updateDataSource = useUpdateDataSourceApiV1DataSourcesDataSourceIdPut();
    const deleteDataSource = useDeleteDataSourceApiV1DataSourcesDataSourceIdDelete();

    const loadUsers = async () => {
        const res = await listOrgMembers();
        setAllUsers(res.data);
    };

    // --- Structure Mode Handlers ---
    const handleRename = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newName = prompt(t('data_source_list.row.rename_prompt'), dataSource.name);
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
        if (confirm(t('data_source_list.row.confirm_delete', { name: dataSource.name }))) {
            await deleteDataSource.mutateAsync({ dataSourceId: dataSource.id });
            onRefetchRequest();
        }
    };

    return (
        <div
            onClick={onClickName}
            className={`
                group flex items-center justify-between p-4 transition-colors first:rounded-t-xl last:rounded-b-xl cursor-pointer
                ${isSelected ? 'bg-brand/10' : 'bg-surface hover:bg-surface-subtle'}
            `}
        >
            {/* LEFT: Checkbox + Name */}
            <div className="flex items-center gap-4 w-1/3">
                {/* Checkbox only appears in Assignment Mode */}
                {!isEditMode && (
                    <div
                        className="w-10 h-10 -ml-2.5 flex items-center justify-center cursor-pointer rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelection(!isSelected);
                        }}
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
                            ${(/^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name)) ? 'text-text-muted italic' : 'text-text-main group-hover/name:text-brand group-hover/name:underline'}
                        `}
                        title={t('data_source_list.row.click_tooltip')}
                    >
                        {(/^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name)) ? t('data_source_list.row.untitled_source') : dataSource.name}
                    </h4>
                    <span
                        className="text-[10px] text-text-muted font-mono mt-0.5 group-hover/name:text-brand transition-colors"
                    >
                        ID: {dataSource.id.split('-').pop()}
                        {(/^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name)) && <span className="ml-1 text-orange-400">• {t('data_source_list.row.rename_required')}</span>}
                    </span>
                </div>
            </div>

            {/* RIGHT: Context-Aware Actions */}
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>

                {/* MODE A: Structure Editing */}
                {isEditMode ? (
                    <div className="flex items-center gap-2">
                        <button onClick={handleRename} className="p-2 text-text-muted hover:text-brand hover:bg-brand/10 rounded-lg">
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={handleDelete} className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    /* MODE B: Assignments (Facepile + Add Button) */
                    <div className="flex items-center gap-3">
                        {/* Facepile */}
                        <div className="flex -space-x-2">
                            {assignedUsers.map((u: any) => (
                                <Avatar key={u.id} className="w-8 h-8 ring-2 ring-white dark:ring-slate-800" title={u.full_name}>
                                    {/* src is likely undefined, checking types tells us MemberRead has no avatar_url. Avatar component handles missing src safely now. */}
                                    <AvatarImage src={(u as any).avatar_url} />
                                    <AvatarFallback className="bg-brand/10 text-brand text-xs">
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
                                <button className="h-8 w-8 rounded-full border border-dashed border-border flex items-center justify-center text-text-muted hover:border-text-muted hover:text-text-main">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-64" side="start">
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

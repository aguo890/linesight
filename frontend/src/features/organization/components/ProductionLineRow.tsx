import React, { useState } from 'react';
import { Checkbox } from '../../../components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { UserSearchCommand } from './UserSearchCommand';
import { updateProductionLineApiV1FactoriesLinesLineIdPatch, deleteProductionLineApiV1FactoriesLinesLineIdDelete } from '../../../api/endpoints/factories/factories';
import { listOrgMembers } from '../../../api/endpoints/team/teamApi';

export const ProductionLineRow = ({
    line,
    assignedUsers,
    isEditMode,
    isSelected,
    onToggleSelection,
    onAssignUser,
    onRefetchRequest,
    isSearchOpen,
    onToggleSearch
}: any) => {
    // const [isSearchOpen, setIsSearchOpen] = useState(false); // Controlled by parent now
    const [allUsers, setAllUsers] = useState<any[]>([]);

    const loadUsers = async () => {
        // Optimization: In a real app, maybe pass allUsers down safely or fetch once
        // But for this interaction, fetching on open is okay or use the context/parent data
        // For simplicity, let's just fetch here or rely on parent. 
        // The UserSearchCommand expects a 'users' prop. The User originally provided code used onSelect but didn't pass 'users' to UserSearchCommand inside ProductionRow. 
        // Wait, the user provided code for ProductionLineRow:
        /*
          <PopoverContent ...>
            <UserSearchCommand onSelect={...} />
          </PopoverContent>
        */
        // The user's code for ProductionLineRow snippet was missing the `users` prop for `UserSearchCommand`. 
        // I should probably fetch users or accept them as a prop. 
        // Given the snippet was partial or assumed, I'll fetch them on demand or assume parent passes them.
        // The parent FactoryConfigurationPage HAS members. I should update parent to pass `members` (aka allUsers) to `ProductionLineRow`.
        const res = await listOrgMembers();
        setAllUsers(res.data);
    };

    // --- Structure Mode Handlers ---
    const handleRename = async () => {
        const newName = prompt("Rename line:", line.name);
        if (newName && newName !== line.name) {
            await updateProductionLineApiV1FactoriesLinesLineIdPatch(line.id, { name: newName });
            onRefetchRequest();
        }
    };

    const handleDelete = async () => {
        if (confirm(`Delete ${line.name}?`)) {
            await deleteProductionLineApiV1FactoriesLinesLineIdDelete(line.id);
            onRefetchRequest();
        }
    };

    return (
        <div className={`
            group flex items-center justify-between p-4 transition-colors first:rounded-t-xl last:rounded-b-xl
            ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}
        `}>
            {/* LEFT: Checkbox + Name */}
            <div className="flex items-center gap-4 w-1/3">
                {/* Checkbox only appears in Assignment Mode */}
                {!isEditMode && (
                    <div className="w-5 h-5 flex items-center justify-center">
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={onToggleSelection}
                            className={`transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        />
                    </div>
                )}
                <div>
                    <h4 className="font-medium text-gray-900 truncate">{line.name}</h4>
                    <span className="text-xs text-gray-500 font-mono">{line.code}</span>
                </div>
            </div>

            {/* RIGHT: Context-Aware Actions */}
            <div className="flex items-center gap-4">

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

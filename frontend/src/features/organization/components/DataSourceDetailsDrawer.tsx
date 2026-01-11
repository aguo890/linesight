import React, { useState } from 'react';
import { X, Users, Trash2, ShieldAlert, Pencil, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { removeUserScope, type MemberRead } from '../../../api/endpoints/team/teamApi';
import {
    useUpdateDataSourceApiV1DataSourcesDataSourceIdPut,
    useDeleteDataSourceApiV1DataSourcesDataSourceIdDelete
} from '../../../api/endpoints/data-sources/data-sources';
import type { DataSourceRead as DataSource } from '../../../api/model';

interface DataSourceDetailsDrawerProps {
    dataSource: DataSource | null;
    isOpen: boolean;
    onClose: () => void;
    allMembers: MemberRead[];
    onDataChange: () => void; // Trigger refetch after edits
    onMemberClick: (member: MemberRead) => void;
}

export const DataSourceDetailsDrawer: React.FC<DataSourceDetailsDrawerProps> = ({
    dataSource,
    isOpen,
    onClose,
    allMembers,
    onDataChange,
    onMemberClick
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');

    const updateDataSource = useUpdateDataSourceApiV1DataSourcesDataSourceIdPut();
    const deleteDataSource = useDeleteDataSourceApiV1DataSourcesDataSourceIdDelete();

    // Reset input when line changes
    React.useEffect(() => {
        if (dataSource) setNameInput(dataSource.name);
    }, [dataSource]);

    if (!dataSource) return null;

    // Filter members assigned to this specific data source
    const assignedMembers = allMembers.filter(m =>
        (m.scopes || []).some(s => s.data_source_id === dataSource.id)
    );

    const handleSaveName = async () => {
        if (!nameInput.trim()) return;
        try {
            await updateDataSource.mutateAsync({
                dataSourceId: dataSource.id,
                data: { name: nameInput }
            });
            onDataChange();
            setIsEditingName(false);
        } catch (error) {
            console.error("Failed to rename data source", error);
            alert("Failed to rename data source.");
        }
    };

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name);

    const handleRemoveUser = async (e: React.MouseEvent, userId: string, scopeId: string) => {
        e.stopPropagation();
        if (confirm("Remove this manager from the data source?")) {
            try {
                setIsLoading(true);
                await removeUserScope(userId, scopeId);
                onDataChange(); // Refresh parent data
            } catch (error) {
                console.error("Failed to remove user", error);
                alert("Failed to remove user.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDelete = async () => {
        if (confirm(`Are you sure you want to delete ${dataSource.name}? This cannot be undone.`)) {
            try {
                setIsLoading(true);
                await deleteDataSource.mutateAsync({ dataSourceId: dataSource.id });
                onDataChange();
                onClose();
            } catch (error) {
                console.error("Failed to delete data source", error);
                alert("Cannot delete data source. It may have active assignments or data.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Slide-over Panel */}
            <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex-1 mr-4">
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    className="h-9 font-bold text-lg"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                />
                                <Button size="sm" onClick={handleSaveName}><Check className="w-4 h-4" /></Button>
                            </div>
                        ) : (
                            <div className="group flex items-center gap-2">
                                <h2 className={`text-lg font-bold truncate ${isUUID ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                                    {isUUID ? `Source ${dataSource.id.split('-').pop()}` : dataSource.name}
                                </h2>
                                <button
                                    onClick={() => { setNameInput(dataSource.name); setIsEditingName(true); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded text-gray-400 transition-opacity"
                                    title="Rename Source"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 font-mono mt-1">ID: {dataSource.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <span className="block text-2xl font-bold text-blue-700">{assignedMembers.length}</span>
                            <span className="text-xs text-blue-600 font-medium uppercase tracking-wide">Managers</span>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 opacity-60">
                            <span className="block text-2xl font-bold text-gray-700">--</span>
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Efficiency</span>
                        </div>
                    </div>

                    {/* Roster Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Users className="w-4 h-4" /> Assigned Team
                            </h3>
                        </div>

                        {assignedMembers.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
                                No managers assigned to this source.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assignedMembers.map(member => {
                                    const scope = (member.scopes || []).find(s => s.data_source_id === dataSource.id);
                                    return (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between p-3 border rounded-lg bg-white hover:border-blue-200 transition-colors group cursor-pointer"
                                            onClick={() => onMemberClick(member)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={member.avatar_url || undefined} />
                                                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                                        {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-medium text-gray-900 truncate w-32">
                                                        {member.full_name || "Unknown"}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate w-32">
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => scope && handleRemoveUser(e, member.id, scope.id)}
                                                disabled={isLoading}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: Danger Zone */}
                <div className="p-6 border-t bg-gray-50">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ShieldAlert className="w-3 h-3" /> Danger Zone
                    </h4>
                    <Button
                        variant="danger"
                        className="w-full gap-2"
                        onClick={handleDelete}
                        disabled={isLoading}
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Data Source
                    </Button>
                </div>
            </div>
        </>
    );
};

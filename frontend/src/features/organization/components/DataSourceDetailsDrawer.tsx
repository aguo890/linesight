import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
            setIsEditingName(false);
        } catch (error) {
            console.error("Failed to rename data source", error);
            alert(t('data_source_list.drawer.rename_fail'));
        }
    };

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(dataSource.name);

    const handleRemoveUser = async (e: React.MouseEvent, userId: string, scopeId: string) => {
        e.stopPropagation();
        if (confirm(t('data_source_list.drawer.confirm_remove'))) {
            try {
                setIsLoading(true);
                await removeUserScope(userId, scopeId);
                onDataChange(); // Refresh parent data
            } catch (error) {
                console.error("Failed to remove user", error);
                alert(t('data_source_list.drawer.remove_fail'));
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDelete = async () => {
        if (confirm(t('data_source_list.drawer.confirm_delete', { name: dataSource.name }))) {
            try {
                setIsLoading(true);
                await deleteDataSource.mutateAsync({ dataSourceId: dataSource.id });
                onDataChange();
                onClose();
            } catch (error) {
                console.error("Failed to delete data source", error);
                alert(t('data_source_list.drawer.delete_fail'));
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
            <div className={`fixed inset-y-0 end-0 w-full max-w-md bg-surface shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out flex flex-col border-inline-start border-border ${isOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex-1 me-4">
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    className="h-9 font-bold text-lg bg-surface-subtle border-border text-text-main"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                />
                                <Button size="sm" onClick={handleSaveName}><Check className="w-4 h-4" /></Button>
                            </div>
                        ) : (
                            <div className="group flex items-center gap-2">
                                <h2 className={`text-lg font-bold truncate ${isUUID ? 'text-text-muted italic' : 'text-text-main'}`}>
                                    {isUUID ? `Source ${dataSource.id.split('-').pop()}` : dataSource.name}
                                </h2>
                                <button
                                    onClick={() => { setNameInput(dataSource.name); setIsEditingName(true); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-subtle rounded text-text-muted transition-opacity"
                                    title={t('data_source_list.drawer.rename_tooltip')}
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-text-muted font-mono mt-1">{t('data_source_list.drawer.id_label', { id: dataSource.id })}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-subtle rounded-full text-text-muted">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-brand/10 p-4 rounded-lg border border-brand/20">
                            <span className="block text-2xl font-bold text-brand">{assignedMembers.length}</span>
                            <span className="text-xs text-brand/80 font-medium uppercase tracking-wide">{t('data_source_list.drawer.managers_stat')}</span>
                        </div>
                        <div className="bg-surface-subtle p-4 rounded-lg border border-border opacity-60">
                            <span className="block text-2xl font-bold text-text-muted">--</span>
                            <span className="text-xs text-text-muted font-medium uppercase tracking-wide">{t('data_source_list.drawer.efficiency_stat')}</span>
                        </div>
                    </div>

                    {/* Roster Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                                <Users className="w-4 h-4" /> {t('data_source_list.drawer.assigned_team')}
                            </h3>
                        </div>

                        {assignedMembers.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg bg-surface-subtle text-text-muted text-sm">
                                {t('data_source_list.drawer.no_managers')}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assignedMembers.map(member => {
                                    const scope = (member.scopes || []).find(s => s.data_source_id === dataSource.id);
                                    return (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between p-3 border border-border rounded-lg bg-surface hover:border-brand/50 transition-colors group cursor-pointer"
                                            onClick={() => onMemberClick(member)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={member.avatar_url || undefined} />
                                                    <AvatarFallback className="text-xs bg-brand/10 text-brand">
                                                        {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-medium text-text-main truncate w-32">
                                                        {member.full_name || t('common.status.unknown')}
                                                    </p>
                                                    <p className="text-xs text-text-muted truncate w-32">
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-text-muted hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => scope && handleRemoveUser(e, member.id, scope.id)}
                                                disabled={isLoading}
                                            >
                                                {t('data_source_list.drawer.remove_button')}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: Danger Zone */}
                <div className="p-6 border-t border-border bg-surface-subtle">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ShieldAlert className="w-3 h-3" /> {t('data_source_list.drawer.danger_zone')}
                    </h4>
                    <Button
                        variant="danger"
                        className="w-full gap-2"
                        onClick={handleDelete}
                        disabled={isLoading}
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('data_source_list.drawer.delete_button')}
                    </Button>
                </div>
            </div>
        </>
    );
};

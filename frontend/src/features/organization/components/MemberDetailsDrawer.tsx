import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Shield, Factory, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import type { MemberRead } from '../../../api/endpoints/team/teamApi';

interface MemberDetailsDrawerProps {
    member: MemberRead | null;
    isOpen: boolean;
    onClose: () => void;
    displayMode?: 'drawer' | 'modal'; // [NEW] Control render mode
    contextLines?: any[];
}

export const MemberDetailsDrawer: React.FC<MemberDetailsDrawerProps> = ({
    member,
    isOpen,
    onClose,
    displayMode = 'drawer',
    contextLines = []
}) => {
    const { t } = useTranslation();
    if (!member) return null;

    const isModal = displayMode === 'modal';

    // Styles for the container (Positioning)
    const containerClasses = isModal
        ? "fixed inset-0 z-[60] flex items-center justify-center p-4" // Center screen, higher Z-index
        : "fixed inset-y-0 right-0 z-50 w-full max-w-[480px]"; // Right side with responsive max-width

    // Styles for the panel (Shape & Animation)
    const panelClasses = isModal
        ? `bg-surface rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col transform transition-all duration-200 scale-100 border border-border`
        : `w-full bg-surface shadow-2xl h-full flex flex-col transform transition-transform duration-300 ease-in-out border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

    // Visibility wrapper
    const visibilityClass = isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none';

    // Helper to safely format role
    const formatRole = (role: string) => {
        if (!role) return t('common.status.unknown');
        const key = role.toLowerCase().replace(/[\s-]/g, '_');
        return t(`roles.${key}`, { defaultValue: role });
    };

    return (
        <div className={`relative ${isModal ? 'z-[60]' : 'z-50'} ${visibilityClass}`}>

            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Layout Container */}
            <div className={`${containerClasses} ${!isOpen ? 'pointer-events-none' : ''}`}>
                <div className={`${panelClasses} overflow-hidden`}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-subtle">
                        <h2 className="text-lg font-semibold text-text-main">{t('org_members.drawer.title')}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-surface-subtle rounded-full text-text-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* Identity */}
                        <div className="flex flex-col items-center text-center">
                            <Avatar className="h-20 w-20 mb-4 border-4 border-surface-subtle">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback className="text-xl bg-brand/10 text-brand">
                                    {(member.full_name || member.email || '').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <h3 className="text-xl font-bold text-text-main">{member.full_name || t('org_members.cell.unknown_user')}</h3>
                            <p className="text-text-muted">{member.email}</p>
                        </div>

                        {/* Section 1: Role */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-text-muted uppercase tracking-wider">{t('org_members.drawer.role_label')}</h4>
                            <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-surface-subtle">
                                <Shield className="w-5 h-5 text-brand" />
                                <span className="capitalize font-medium text-text-main">
                                    {formatRole(member.role)}
                                </span>
                            </div>
                        </div>

                        {/* Section 2: Scopes */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-text-muted uppercase tracking-wider">{t('org_members.drawer.active_assignments')}</h4>
                                <span className="text-xs bg-surface-subtle px-2 py-0.5 rounded-full text-text-muted border border-border">
                                    {(member.scopes || []).length}
                                </span>
                            </div>
                            {(member.scopes || []).length === 0 ? (
                                <p className="text-sm text-text-muted italic">{t('org_members.drawer.no_assignments')}</p>
                            ) : (
                                <div className="border border-border rounded-lg divide-y divide-border">
                                    {(member.scopes || []).map((scope: any) => {
                                        // [NEW] LOOKUP LOGIC
                                        const knownLine = contextLines.find(l => l.id === scope.production_line_id);
                                        const productionLineId = scope.production_line_id || '';
                                        const displayName = knownLine ? knownLine.name : `External Line (${productionLineId.slice(-4)})`;
                                        const isContextual = !!knownLine;

                                        return (
                                            <div key={scope.id} className="p-3 flex items-center justify-between bg-surface">
                                                <div className="flex items-center gap-3">
                                                    <Factory className={`w-4 h-4 ${isContextual ? 'text-brand' : 'text-text-muted'}`} />
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-medium ${isContextual ? 'text-text-main' : 'text-text-muted'}`}>
                                                            {displayName}
                                                        </span>
                                                        {isContextual && (
                                                            <span className="text-[10px] text-text-muted font-mono">
                                                                {knownLine.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {isContextual && (
                                                    <Badge variant="outline" className="text-[10px] font-normal border-border text-text-muted">
                                                        {t('org_members.drawer.current_factory')}
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Section 3: Danger Zone */}
                        <div className="space-y-3 pt-6 border-t border-border">
                            <h4 className="text-sm font-medium text-danger uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> {t('org_members.drawer.danger_zone.title')}
                            </h4>
                            <Button variant="danger" className="w-full">{t('org_members.drawer.danger_zone.suspend_button')}</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

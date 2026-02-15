/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Filter } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useOrgMembers } from '@/features/organization/hooks/useOrgMembers';
import { MemberIdentityCell } from '@/features/organization/components/MemberIdentityCell';
import { MemberDetailsDrawer } from '@/features/organization/components/MemberDetailsDrawer';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import type { MemberRead } from '../../../api/endpoints/team/teamApi';

export const OrgMembersPage = () => {
    const { t } = useTranslation();
    const { members, isLoading } = useOrgMembers();
    const [selectedMember, setSelectedMember] = useState<MemberRead | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Client-side filtering
    const filteredMembers = members.filter(m =>
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Updated formatRole to be robust against backend casing
    const formatRole = (role: string) => {
        if (!role) return t('common.status.unknown');

        // Sanitize: lowercase, replace spaces/hyphens with underscore
        const key = role.toLowerCase().replace(/[\s-]/g, '_');

        // Return translation with the original string as a fallback if key is missing
        return t(`roles.${key}`, { defaultValue: role });
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Page Header with Back Button */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <SettingsPageHeader title={t('org_members.title')} />
                <Button onClick={() => console.log('Invite feature coming soon')} className="gap-2 bg-brand hover:bg-brand-dark text-white shadow-sm transition-all hover:shadow-md">
                    <Plus className="w-4 h-4" /> {t('common.actions.invite')}
                </Button>
            </div>



            {/* Toolbar */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <Input
                        placeholder={t('common.actions.search')}
                        className="pl-9 bg-surface border-border text-text-main placeholder:text-text-muted focus-visible:ring-brand"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="gap-2 text-text-muted hover:text-text-main border-border bg-surface hover:bg-surface-subtle">
                    <Filter className="w-4 h-4" /> {t('org_members.filter')}
                </Button>
            </div>

            {/* Smart Table */}
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-subtle border-b border-border text-text-muted font-medium">
                        <tr>
                            <th className="px-6 py-4">{t('org_members.table.user')}</th>
                            <th className="px-6 py-4">{t('org_members.table.global_role')}</th>
                            <th className="px-6 py-4">{t('org_members.table.access')}</th>
                            <th className="px-6 py-4">{t('org_members.table.last_active')}</th>
                            <th className="px-6 py-4 text-right">{t('org_members.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isLoading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-text-muted">{t('org_members.table.loading')}</td></tr>
                        ) : filteredMembers.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-text-muted">{t('org_members.table.no_members')}</td></tr>
                        ) : (
                            filteredMembers.map((member) => (
                                <tr
                                    key={member.id}
                                    onClick={() => setSelectedMember(member)}
                                    className="hover:bg-surface-subtle transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-3">
                                        <MemberIdentityCell member={{
                                            full_name: member.full_name || undefined,
                                            email: member.email,
                                            avatar_url: member.avatar_url || undefined,
                                            is_active: member.is_active
                                        }} />
                                    </td>
                                    <td className="px-6 py-3">
                                        <Badge variant="outline" className="font-normal text-text-muted bg-surface-subtle border-border">
                                            {formatRole(member.role)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-3">
                                        {(member.scopes?.length || 0) > 0 ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                                                {t('org_members.table.assignments', { count: member.scopes?.length || 0 })}
                                            </span>
                                        ) : (
                                            <span className="text-text-muted italic opacity-75">{t('org_members.table.unassigned')}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-text-muted">
                                        {member.last_login
                                            ? new Date(member.last_login).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                            : t('org_members.table.never_active')}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <span className="text-text-muted group-hover:text-brand font-medium text-xs transition-colors">{t('org_members.table.view_details')} &rarr;</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* The Drawer Component */}
            <MemberDetailsDrawer
                member={selectedMember}
                isOpen={!!selectedMember}
                onClose={() => setSelectedMember(null)}
            />
        </div>
    );
};
export default OrgMembersPage;
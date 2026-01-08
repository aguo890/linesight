import React, { useState } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useOrgMembers } from '../hooks/useOrgMembers';
import { MemberIdentityCell } from '../components/MemberIdentityCell';
import { MemberDetailsDrawer } from '../components/MemberDetailsDrawer';
import type { MemberRead } from '../../../api/endpoints/team/teamApi';

export const OrgMembersPage = () => {
    const { members, isLoading } = useOrgMembers();
    const [selectedMember, setSelectedMember] = useState<MemberRead | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Client-side filtering
    const filteredMembers = members.filter(m =>
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Members</h1>
                    <p className="text-gray-500 mt-1">Manage who has access to your organization.</p>
                </div>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4" /> Invite Member
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by name or email..."
                        className="pl-9 bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="gap-2 text-gray-600">
                    <Filter className="w-4 h-4" /> Filter
                </Button>
            </div>

            {/* Smart Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Global Role</th>
                            <th className="px-6 py-4">Access</th>
                            <th className="px-6 py-4">Last Active</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading members...</td></tr>
                        ) : filteredMembers.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-500">No members found.</td></tr>
                        ) : (
                            filteredMembers.map((member) => (
                                <tr
                                    key={member.id}
                                    onClick={() => setSelectedMember(member)}
                                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
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
                                        <Badge variant="outline" className="capitalize font-normal text-gray-600 bg-gray-50">
                                            {member.role}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-3">
                                        {member.scopes.length > 0 ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {member.scopes.length} Assignments
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-gray-500">
                                        {member.last_login
                                            ? new Date(member.last_login).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                            : 'Never'}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <span className="text-gray-400 group-hover:text-blue-600 font-medium text-xs">View Details &rarr;</span>
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

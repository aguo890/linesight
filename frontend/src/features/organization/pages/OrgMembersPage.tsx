/**
 * Organization Members Page
 * 
 * Searchable data table of all organization members.
 * Scalable for 500+ users with filter/search capabilities.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listOrgMembers, type MemberRead } from '../../../api/endpoints/team/teamApi';
import { Search, UserPlus, GitBranch, ChevronRight } from 'lucide-react';

const OrgMembersPage: React.FC = () => {
    const navigate = useNavigate();
    const [members, setMembers] = useState<MemberRead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const res = await listOrgMembers();
                setMembers(res.data);
            } catch (err) {
                console.error('Failed to fetch members:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMembers();
    }, []);

    // Filter and search logic
    const filteredMembers = useMemo(() => {
        return members.filter((member) => {
            // Role filter
            if (roleFilter !== 'all' && member.role !== roleFilter) {
                return false;
            }
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    member.email.toLowerCase().includes(query) ||
                    member.full_name?.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [members, searchQuery, roleFilter]);

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'system_admin':
                return 'bg-red-100 text-red-700';
            case 'owner':
                return 'bg-blue-100 text-blue-700';
            case 'manager':
                return 'bg-emerald-100 text-emerald-700';
            case 'analyst':
                return 'bg-purple-100 text-purple-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const getAssignmentStatus = (member: MemberRead) => {
        if (member.role !== 'manager') return null;
        const lineCount = member.scopes?.length || 0;
        if (lineCount === 0) {
            return <span className="text-xs text-amber-600 font-medium">Unassigned</span>;
        }
        return <span className="text-xs text-emerald-600 font-medium">{lineCount} line(s)</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Members</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">
                        {members.length} members in your organization
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/settings/organization/assignments')}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg hover:bg-[var(--color-border)]/30 transition-colors text-sm font-medium"
                    >
                        <GitBranch className="w-4 h-4" />
                        Visual Assignment
                    </button>
                    <button
                        disabled
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
                    >
                        <UserPlus className="w-4 h-4" />
                        Invite User
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
                    />
                </div>

                {/* Role Filter */}
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                >
                    <option value="all">All Roles</option>
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="analyst">Analyst</option>
                    <option value="viewer">Viewer</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <table className="w-full">
                    <thead className="bg-[var(--color-background)]">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">
                                Name
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">
                                Email
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">
                                Role
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">
                                Assignment
                            </th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {filteredMembers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                                    No members found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredMembers.map((member) => (
                                <tr key={member.id} className="hover:bg-[var(--color-background)]/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-[var(--color-text)]">
                                            {member.full_name || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                                        {member.email}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadgeColor(member.role)}`}>
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {getAssignmentStatus(member)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <ChevronRight className="w-4 h-4 text-[var(--color-text-subtle)]" />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Stats */}
            <div className="mt-4 text-sm text-[var(--color-text-muted)]">
                Showing {filteredMembers.length} of {members.length} members
            </div>
        </div>
    );
};

export default OrgMembersPage;

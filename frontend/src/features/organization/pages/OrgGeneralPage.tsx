import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { AXIOS_INSTANCE } from '../../../api/axios-client';
import { Building2, Users, Factory, Crown, AlertTriangle } from 'lucide-react';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';

interface OrgStats {
    totalManagers: number;
    assignedManagers: number;
    unassignedManagers: number;
    totalFactories: number;
    totalLines: number;
}

const StatCard: React.FC<{
    icon: React.ElementType;
    label: string;
    value: string | number;
    color: string;
}> = ({ icon: Icon, label, value, color }) => (
    <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)] hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
        </div>
        <div className="text-3xl font-bold text-[var(--color-text)]">{value}</div>
    </div>
);

const OrgGeneralPage: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<OrgStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch members to count managers
                const membersRes = await AXIOS_INSTANCE.get('/api/v1/organizations/members');
                const members = membersRes.data || [];

                // Filter managers (handle potentially different matching strategies or role strings)
                const managers = members.filter((m: any) => {
                    const role = m.role || '';
                    return role === 'factory_manager' || role === 'line_manager';
                });

                // Count assigned managers (must have at least one scope)
                const assignedManagers = managers.filter((m: any) => m.scopes && m.scopes.length > 0);

                // Fetch factories
                const factoriesRes = await AXIOS_INSTANCE.get('/api/v1/factories');
                const factories = factoriesRes.data || [];

                // Count lines (now Data Sources) per factory (Parallel Fetching)
                const linePromises = factories.map((factory: any) =>
                    AXIOS_INSTANCE.get(`/api/v1/factories/${factory.id}/data-sources`)
                        .then(res => res.data?.length || 0)
                        .catch(err => {
                            console.warn(`Failed to fetch data sources for factory ${factory.id}`, err);
                            return 0;
                        })
                );

                const lineCounts = await Promise.all(linePromises);
                const totalLines = lineCounts.reduce((a, b) => a + b, 0);

                setStats({
                    totalManagers: managers.length,
                    assignedManagers: assignedManagers.length,
                    unassignedManagers: managers.length - assignedManagers.length,
                    totalFactories: factories.length,
                    totalLines,
                });
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Header with Back Button */}
            <SettingsPageHeader title="General" />

            {/* Organization Profile Card */}
            <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/60 rounded-xl flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[var(--color-text)]">Demo Organization</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Logged in as <span className="font-medium">{user?.email}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            <Crown className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-amber-600 font-medium uppercase tracking-wide">
                                {user?.role === 'system_admin' ? 'System Admin' : 'Owner'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* At a Glance Stats */}
            <h3 className="text-sm font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-4">
                At a Glance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={Users}
                    label="Total Managers"
                    value={stats?.totalManagers || 0}
                    color="bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                />
                <StatCard
                    icon={Users}
                    label="Assigned"
                    value={stats?.assignedManagers || 0}
                    color="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                />
                <StatCard
                    icon={Factory}
                    label="Factories"
                    value={stats?.totalFactories || 0}
                    color="bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                />
                <StatCard
                    icon={Factory}
                    label="Production Lines"
                    value={stats?.totalLines || 0}
                    color="bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                />
            </div>

            {/* Danger Zone */}
            <div className="border border-red-200 dark:border-red-900/30 rounded-xl p-6 bg-red-50/50 dark:bg-red-900/10">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-200">Danger Zone</h3>
                </div>
                <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                    Deleting an organization will permanently remove all factories, production lines, and data.
                </p>
                <button
                    disabled
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-400 dark:text-red-300 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                    Delete Organization (Coming Soon)
                </button>
            </div>
        </div>
    );
};

export default OrgGeneralPage;

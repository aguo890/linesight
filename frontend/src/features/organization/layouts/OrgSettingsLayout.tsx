/**
 * Organization Settings Layout
 * 
 * Hub with settings sidebar navigation and Outlet for sub-pages.
 * Following AWS/GitHub "Hub and Spoke" pattern.
 */

import React from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from '../../../components/layout/MainLayout';
import { Building2, Users, GitBranch, CreditCard, FileText } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface NavItemProps {
    to: string;
    icon: React.ElementType;
    label: string;
    disabled?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, disabled }) => {
    if (disabled) {
        return (
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--color-text-subtle)] cursor-not-allowed opacity-50">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                <span className="ml-auto text-[10px] bg-[var(--color-border)] px-1.5 py-0.5 rounded">Soon</span>
            </div>
        );
    }

    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors",
                    isActive
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/30 hover:text-[var(--color-text)]"
                )
            }
        >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </NavLink>
    );
};

const OrgSettingsLayout: React.FC = () => {
    const location = useLocation();

    // Redirect /organization/settings to /organization/settings/general
    if (location.pathname === '/organization/settings' || location.pathname === '/organization/settings/') {
        return <Navigate to="/organization/settings/general" replace />;
    }

    return (
        <MainLayout disablePadding>
            <div className="flex h-full min-h-[calc(100vh-4rem)]">
                {/* Settings Sidebar */}
                <aside className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 shrink-0">
                    <h2 className="font-bold text-[var(--color-text)] mb-4 px-3">Organization</h2>

                    <nav className="space-y-1">
                        <NavItem to="/organization/settings/general" icon={Building2} label="General" />
                        <NavItem to="/organization/settings/members" icon={Users} label="Members" />
                        <NavItem to="/organization/settings/factories" icon={Building2} label="Factories" />

                        <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                            <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider mb-2 px-3">
                                Coming Soon
                            </p>
                            <NavItem to="/organization/settings/billing" icon={CreditCard} label="Billing" disabled />
                            <NavItem to="/organization/settings/audit" icon={FileText} label="Audit Logs" disabled />
                        </div>
                    </nav>
                </aside>

                {/* Content Area */}
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </MainLayout>
    );
};

export default OrgSettingsLayout;

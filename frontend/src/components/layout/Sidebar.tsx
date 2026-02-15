/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, ChevronDown, PanelLeft, Users } from 'lucide-react';
import { dashboardStorage } from '../../features/dashboard/storage';
import type { SavedDashboard } from '../../features/dashboard/types';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next'; // [I18N]
import type { ParseKeys } from 'i18next'; // [I18N]
import { Logo } from '../common/Logo';
import { cn } from '@/lib/utils';
import { AutoFlipIcon } from '../common/AutoFlipIcon';

const INITIAL_DASHBOARD_LIMIT = 5;

interface NavItem {
    labelKey: ParseKeys<'translation'>;
    icon: React.ElementType;
    path: string;
    matchPaths: string[];
    ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    {
        labelKey: 'navigation.my_dashboards',
        icon: LayoutGrid,
        path: '/dashboard/factories',
        matchPaths: ['/dashboard/factories']
    },
    {
        labelKey: 'navigation.organization',
        icon: Users,
        path: '/organization/settings',
        matchPaths: ['/organization/settings'],
        ownerOnly: true
    }
];

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
    const { t } = useTranslation(); // [I18N]
    const location = useLocation();
    const navigate = useNavigate();
    const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
    const [showAllDashboards, setShowAllDashboards] = useState(false);
    const [isDashboardsExpanded] = useState(true);

    // PERSISTENCE: MainLayout handles the state now.
    // We could still persist to localStorage if MainLayout initializes from it.
    // But for now we follow the user's specific request for an implementation plan that uses MainLayout.

    // consume context
    const { } = useOrganization();
    const { user } = useAuth();
    const isOwner = user?.role === 'owner' || user?.role === 'system_admin';

    useEffect(() => {
        loadDashboards();
        // Listen for dashboard updates
        const handleStorageChange = () => {
            console.log('Sidebar: handleStorageChange triggered');
            loadDashboards();
        };
        window.addEventListener('dashboards-updated', handleStorageChange);
        return () => window.removeEventListener('dashboards-updated', handleStorageChange);
    }, []);

    const loadDashboards = () => {
        // Create a shallow copy to ensure React detects the change and re-renders
        setDashboards([...dashboardStorage.getDashboards()]);
    };

    // Helper to check if active for basic highlighting

    const isDashboardActive = (dashboard: SavedDashboard) => {
        return location.pathname === `/dashboard/factories/${dashboard.factoryId}/dashboards/${dashboard.id}`;
    };

    const handleDashboardClick = (dashboard: SavedDashboard) => {
        dashboardStorage.setActiveId(dashboard.id);
        if (dashboard.factoryId) {
            navigate(`/dashboard/factories/${dashboard.factoryId}/dashboards/${dashboard.id}`);
        } else {
            // Fallback: Navigate to factories list if no factoryId available
            navigate('/dashboard/factories');
        }
    };

    // Determine which dashboards to show
    const visibleDashboards = showAllDashboards
        ? dashboards
        : dashboards.slice(0, INITIAL_DASHBOARD_LIMIT);

    const hasMoreDashboards = dashboards.length > INITIAL_DASHBOARD_LIMIT;

    // Check if we're in any dashboard route
    const isInDashboardsSection = location.pathname.startsWith('/dashboard/') && location.pathname !== '/dashboard';



    const isRTL = document.dir === 'rtl';

    return (
        <>
            <aside className={cn(
                "h-screen bg-[var(--color-surface-elevated)] border-inline-end border-[var(--color-border)] flex flex-col shrink-0 transition-all duration-300 ease-in-out z-50",
                // Mobile: Fixed overlay. Desktop: Relative rail or full width.
                "fixed inset-y-0 start-0 md:relative md:translate-x-0",
                isOpen
                    ? "w-64 translate-x-0"
                    : cn(
                        "w-64 md:w-[70px] md:translate-x-0",
                        isRTL ? "translate-x-full" : "-translate-x-full"
                    )
            )}>
                {/* BRAND SECTION */}
                <div className={cn(
                    "flex items-center border-[var(--color-border)] transition-all duration-300 border-b",
                    isOpen
                        ? "h-16 justify-between px-6"
                        : "h-16 justify-center relative"
                )}>
                    <button onClick={() => navigate('/')} className="flex items-center group justify-center">
                        <Logo variant="app" showText={isOpen} />
                    </button>
                    <button
                        onClick={onToggle}
                        className={cn(
                            "p-1.5 rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors",
                            isOpen
                                ? "hover:bg-[var(--color-border)]/20"
                                : "absolute bottom-0 translate-y-1/2 left-1/2 -translate-x-1/2 z-10 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-sm hidden md:flex items-center justify-center rounded-full hover:bg-[var(--color-surface)]"
                        )}
                        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
                        aria-expanded={isOpen}
                    >
                        <AutoFlipIcon icon={PanelLeft} className={cn("w-4 h-4 transition-transform", !isOpen && "rotate-180")} />
                    </button>
                </div>

                <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                    {NAV_ITEMS.map((item) => {
                        if (item.ownerOnly && !isOwner) return null;

                        const active = item.matchPaths.some(p =>
                            location.pathname === p || location.pathname.startsWith(p + '/')
                        );

                        // Special handling for My Dashboards with its dynamic subsections
                        if (item.labelKey === 'navigation.my_dashboards') {
                            return (
                                <div key={item.path}>
                                    <div
                                        title={!isOpen ? t(item.labelKey) : undefined}
                                        className={cn(
                                            "w-full flex items-center border-s-4 transition-colors",
                                            active || isInDashboardsSection
                                                ? 'bg-[var(--color-surface)] border-[var(--color-primary)]'
                                                : 'border-transparent hover:bg-[var(--color-border)]/20',
                                            isOpen ? "" : "justify-center border-s-0"
                                        )}
                                    >
                                        <button
                                            onClick={() => navigate(item.path)}
                                            className={cn(
                                                "flex items-center py-2.5 text-sm font-semibold transition-colors",
                                                active || isInDashboardsSection
                                                    ? 'text-[var(--color-text)]'
                                                    : 'text-[var(--color-text-muted)]',
                                                isOpen ? "flex-1 px-4" : "justify-center px-0 w-full"
                                            )}
                                        >
                                            <item.icon className={cn(
                                                "w-5 h-5 flex-shrink-0 transition-colors",
                                                isOpen ? "me-3" : "me-0",
                                                active || isInDashboardsSection
                                                    ? 'text-[var(--color-primary)]'
                                                    : 'text-[var(--color-text-subtle)]'
                                            )} />
                                            <span className={cn(
                                                "transition-all duration-300 overflow-hidden whitespace-nowrap text-start flex-1",
                                                isOpen ? "opacity-100 max-w-[200px]" : "opacity-0 w-0 hidden"
                                            )}>{t(item.labelKey)}</span>
                                        </button>
                                    </div>

                                    {/* Subsections - Individual Dashboards */}
                                    {isDashboardsExpanded && visibleDashboards.filter(d => d.id !== 'default').length > 0 && (
                                        <div className="mt-1 ms-4 space-y-0.5 border-s-2 border-[var(--color-border)]">
                                            {visibleDashboards.filter(d => d.id !== 'default').map((dashboard) => (
                                                <button
                                                    key={dashboard.id}
                                                    onClick={() => handleDashboardClick(dashboard)}
                                                    className={`w-full flex items-center ps-4 pe-4 py-2 text-sm transition-colors ${isDashboardActive(dashboard)
                                                        ? 'bg-[var(--color-surface)] text-[var(--color-primary)] font-medium'
                                                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 hover:text-[var(--color-text)]'
                                                        }`}
                                                >
                                                    <span className="flex-1 truncate text-start">{dashboard.name}</span>
                                                    <span className="text-xs text-[var(--color-text-subtle)]">
                                                        {dashboard.widgets?.length || 0}
                                                    </span>
                                                </button>
                                            ))}

                                            {hasMoreDashboards && !showAllDashboards && dashboards.filter(d => d.id !== 'default').length > INITIAL_DASHBOARD_LIMIT && (
                                                <button
                                                    onClick={() => setShowAllDashboards(true)}
                                                    className="w-full flex items-center justify-center ps-4 pe-4 py-2 text-xs text-[var(--color-primary)] hover:bg-[var(--color-border)]/20 transition-colors"
                                                >
                                                    <span>{t('navigation.show_more')}</span>
                                                    <ChevronDown className="w-3 h-3 ms-1" />
                                                </button>
                                            )}

                                            {showAllDashboards && (
                                                <button
                                                    onClick={() => setShowAllDashboards(false)}
                                                    className="w-full flex items-center justify-center px-4 py-2 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 transition-colors"
                                                >
                                                    <span>{t('navigation.show_less')}</span>
                                                    <ChevronDown className="w-3 h-3 ms-1 transform rotate-180" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Regular Nav Item
                        return (
                            <React.Fragment key={item.path}>
                                {item.labelKey === 'navigation.organization' && (
                                    <div className={cn("px-4 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-2 mt-6", !isOpen && "hidden")}>
                                        {t('navigation.organization')}
                                    </div>
                                )}
                                <button
                                    onClick={() => navigate(item.path)}
                                    title={!isOpen ? t(item.labelKey) : undefined}
                                    className={cn(
                                        "w-full flex items-center py-2.5 text-sm font-semibold border-s-4 transition-colors",
                                        active
                                            ? 'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-text)]'
                                            : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20',
                                        isOpen ? "px-4" : "justify-center px-0 border-s-0"
                                    )}
                                >
                                    <item.icon className={cn(
                                        "w-5 h-5 flex-shrink-0",
                                        isOpen ? "me-3" : "me-0",
                                        active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'
                                    )} />
                                    <span className={cn(
                                        "transition-all duration-300 overflow-hidden whitespace-nowrap text-start flex-1",
                                        isOpen ? "opacity-100 max-w-[200px]" : "opacity-0 w-0 hidden"
                                    )}>{t(item.labelKey)}</span>
                                </button>
                            </React.Fragment>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[var(--color-border)] space-y-3">
                    {/* Footer Section - Cleanup: Removed redundant toggle button */}

                    {/* Subscription Plan Badge & AI Insight - Hidden for "Less is More" cleanup
                    <div className={cn(isOpen ? "block" : "hidden")}>
                       ... (Code removed for design simplicity) ...
                    </div>
                    */}

                    {/* Temporary Debug Button - Remove before production */}
                    {/* <button
                        onClick={() => {
                            if (window.confirm('WARNING: This will wipe all saved dashboards. Continue?')) {
                                // Attempt to clear common keys, or check your storage.ts for the exact key
                                localStorage.removeItem('dashboards');
                                localStorage.removeItem('saved_dashboards');
                                window.location.reload();
                            }
                        }}
                        className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded border border-red-200 transition-colors"
                    >
                        [DEBUG] FORCE RESET STORAGE
                    </button> */}
                </div>
            </aside>
        </>
    );
};

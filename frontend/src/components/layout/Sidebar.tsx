import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, ChevronDown, PanelLeft, Users } from 'lucide-react';
import { dashboardStorage } from '../../features/dashboard/storage';
import type { SavedDashboard } from '../../features/dashboard/types';

import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next'; // [I18N]
import type { ParseKeys } from 'i18next'; // [I18N]
import { Logo } from '../common/Logo';
import { cn } from '../../lib/utils';

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

export const Sidebar: React.FC = () => {
    const { t } = useTranslation(); // [I18N]
    const location = useLocation();
    const navigate = useNavigate();
    const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
    const [showAllDashboards, setShowAllDashboards] = useState(false);
    const [isDashboardsExpanded, setIsDashboardsExpanded] = useState(true);

    // Collapsible sidebar state with localStorage persistence
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebar-open');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('sidebar-open', JSON.stringify(isSidebarOpen));
        // Dispatch custom event for MainLayout to react to
        window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { isOpen: isSidebarOpen } }));
    }, [isSidebarOpen]);

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



    return (
        <>
            <aside className={cn(
                "fixed top-0 start-0 z-50 h-screen bg-[var(--color-surface-elevated)] border-inline-end border-[var(--color-border)] flex flex-col shrink-0 transition-all duration-300 ease-in-out",
                isSidebarOpen ? "w-64" : "w-[70px]"
            )}>
                {/* BRAND SECTION */}
                <div className={cn(
                    "flex items-center border-[var(--color-border)] transition-all duration-300",
                    isSidebarOpen
                        ? "h-16 justify-between px-6 border-b"
                        : "h-auto flex-col justify-center py-4 gap-4 border-b-0"
                )}>
                    <button onClick={() => navigate('/')} className="flex items-center group justify-center">
                        <Logo variant="app" showText={isSidebarOpen} />
                    </button>
                    <button
                        onClick={toggleSidebar}
                        className={cn(
                            "p-1.5 rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors",
                            !isSidebarOpen && "hidden"
                        )}
                    >
                        <PanelLeft className="w-4 h-4" />
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
                                        title={!isSidebarOpen ? t(item.labelKey) : undefined}
                                        className={cn(
                                            "w-full flex items-center border-l-4 transition-colors",
                                            active || isInDashboardsSection
                                                ? 'bg-[var(--color-surface)] border-[var(--color-primary)]'
                                                : 'border-transparent hover:bg-[var(--color-border)]/20',
                                            isSidebarOpen ? "" : "justify-center border-l-0"
                                        )}
                                    >
                                        <button
                                            onClick={() => navigate(item.path)}
                                            className={cn(
                                                "flex items-center py-2.5 text-sm font-semibold transition-colors",
                                                active || isInDashboardsSection
                                                    ? 'text-[var(--color-text)]'
                                                    : 'text-[var(--color-text-muted)]',
                                                isSidebarOpen ? "flex-1 px-4" : "justify-center px-0 w-full"
                                            )}
                                        >
                                            <item.icon className={cn(
                                                "w-5 h-5 transition-colors",
                                                isSidebarOpen ? "me-3" : "me-0",
                                                active || isInDashboardsSection
                                                    ? 'text-[var(--color-primary)]'
                                                    : 'text-[var(--color-text-subtle)]'
                                            )} />
                                            <span className={cn(
                                                "transition-all duration-300 overflow-hidden whitespace-nowrap text-left flex-1",
                                                isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0 hidden"
                                            )}>{t(item.labelKey)}</span>
                                        </button>
                                    </div>

                                    {/* Subsections - Individual Dashboards */}
                                    {isDashboardsExpanded && visibleDashboards.filter(d => d.id !== 'default').length > 0 && (
                                        <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[var(--color-border)]">
                                            {visibleDashboards.filter(d => d.id !== 'default').map((dashboard) => (
                                                <button
                                                    key={dashboard.id}
                                                    onClick={() => handleDashboardClick(dashboard)}
                                                    className={`w-full flex items-center pl-4 pr-4 py-2 text-sm transition-colors ${isDashboardActive(dashboard)
                                                        ? 'bg-[var(--color-surface)] text-[var(--color-primary)] font-medium'
                                                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 hover:text-[var(--color-text)]'
                                                        }`}
                                                >
                                                    <span className="flex-1 truncate text-left">{dashboard.name}</span>
                                                    <span className="text-xs text-[var(--color-text-subtle)]">
                                                        {dashboard.widgets?.length || 0}
                                                    </span>
                                                </button>
                                            ))}

                                            {hasMoreDashboards && !showAllDashboards && dashboards.filter(d => d.id !== 'default').length > INITIAL_DASHBOARD_LIMIT && (
                                                <button
                                                    onClick={() => setShowAllDashboards(true)}
                                                    className="w-full flex items-center justify-center pl-4 pr-4 py-2 text-xs text-[var(--color-primary)] hover:bg-[var(--color-border)]/20 transition-colors"
                                                >
                                                    <span>{t('navigation.show_more')}</span>
                                                    <ChevronDown className="w-3 h-3 ml-1" />
                                                </button>
                                            )}

                                            {showAllDashboards && (
                                                <button
                                                    onClick={() => setShowAllDashboards(false)}
                                                    className="w-full flex items-center justify-center px-4 py-2 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 transition-colors"
                                                >
                                                    <span>{t('navigation.show_less')}</span>
                                                    <ChevronDown className="w-3 h-3 ml-1 transform rotate-180" />
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
                                    <div className={cn("px-4 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-2 mt-6", !isSidebarOpen && "hidden")}>
                                        {t('navigation.organization')}
                                    </div>
                                )}
                                <button
                                    onClick={() => navigate(item.path)}
                                    title={!isSidebarOpen ? t(item.labelKey) : undefined}
                                    className={cn(
                                        "w-full flex items-center py-2.5 text-sm font-semibold border-l-4 transition-colors",
                                        active
                                            ? 'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-text)]'
                                            : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20',
                                        isSidebarOpen ? "px-4" : "justify-center px-0 border-l-0"
                                    )}
                                >
                                    <item.icon className={cn(
                                        "w-5 h-5 flex-shrink-0",
                                        isSidebarOpen ? "mr-3" : "mr-0",
                                        active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'
                                    )} />
                                    <span className={cn(
                                        "transition-all duration-300 overflow-hidden whitespace-nowrap text-left flex-1",
                                        isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                                    )}>{t(item.labelKey)}</span>
                                </button>
                            </React.Fragment>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[var(--color-border)] space-y-3">
                    {/* Collapsed Mode: Toggle Button in Footer (for mobile or alternate) - user example had it. 
                        Since we have toggle in header for desktop, let's follow user pattern:
                        Header toggle is hidden on mobile? User example: "hidden lg:flex" for header toggle, "lg:hidden" for footer.
                        But I'll just use the header toggle for consistency unless space is issue.
                        Currently I put header toggle in header.
                        Let's just handle visibility of content.
                    */}
                    {!isSidebarOpen && (
                        <div className="flex justify-center mb-2">
                            <button
                                onClick={toggleSidebar}
                                className="p-2 rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors"
                                title="Expand Sidebar"
                            >
                                <PanelLeft className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Subscription Plan Badge & AI Insight - Hidden for "Less is More" cleanup
                    <div className={cn(isSidebarOpen ? "block" : "hidden")}>
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
            </aside >
        </>
    );
};

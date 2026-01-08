import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, ChevronDown, PanelLeft, Users } from 'lucide-react';
import { dashboardStorage } from '../../features/dashboard/storage';
import type { SavedDashboard } from '../../features/dashboard/types';

import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../hooks/useAuth';
import { Logo } from '../common/Logo';
import { cn } from '../../lib/utils';

const INITIAL_DASHBOARD_LIMIT = 5;

export const Sidebar: React.FC = () => {
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
    const isActive = (path: string) => location.pathname === path;

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
                "fixed top-0 left-0 z-50 h-screen bg-[var(--color-surface-elevated)] border-r border-[var(--color-border)] flex flex-col shrink-0 transition-all duration-300 ease-in-out",
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
                    {/* Core Header replaced by Brand Section usually, but keeping list structure. Removing explicit Core header text to clean updated layout if desired, or keeping it below. User prompt said 'place logo at top', implies replacing header or sitting above it. I will remove the 'Core' text label to avoid clutter right under the logo unless needed. I'll comment it out or just start with items. Let's keep it clean as per 'Industry Standard' typically has list starts or a section header. I'll add a small spacer if needed. */}

                    {/* Overview */}
                    {/* Overview */}
                    {/*
                    <button
                        onClick={() => navigate('/dashboard')}
                        title={!isSidebarOpen ? "Overview" : undefined}
                        className={cn(
                            "w-full flex items-center py-2.5 text-sm font-semibold border-l-4 transition-colors",
                            isActive('/dashboard')
                                ? 'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-text)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20',
                            isSidebarOpen ? "px-4" : "justify-center px-0 border-l-0"
                        )}
                    >
                        <svg className={cn("w-5 h-5 flex-shrink-0", isSidebarOpen ? "mr-3" : "mr-0", isActive('/dashboard') ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-subtle)]')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className={cn(
                            "transition-all duration-300 overflow-hidden whitespace-nowrap text-left flex-1",
                            isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                        )}>Overview</span>
                    </button>
                    */}

                    {/* My Dashboards - Split Button (Navigate + Toggle) */}
                    <div>
                        <div
                            title={!isSidebarOpen ? "My Dashboards" : undefined}
                            className={cn(
                                "w-full flex items-center border-l-4 transition-colors",
                                isActive('/dashboard/factories') || isInDashboardsSection
                                    ? 'bg-[var(--color-surface)] border-[var(--color-primary)]'
                                    : 'border-transparent hover:bg-[var(--color-border)]/20',
                                isSidebarOpen ? "" : "justify-center border-l-0"
                            )}
                        >
                            {/* Left: Navigation Button */}
                            <button
                                onClick={() => navigate('/dashboard/factories')}
                                className={cn(
                                    "flex items-center py-2.5 text-sm font-semibold transition-colors",
                                    isActive('/dashboard/factories') || isInDashboardsSection
                                        ? 'text-[var(--color-text)]'
                                        : 'text-[var(--color-text-muted)]',
                                    isSidebarOpen ? "flex-1 px-4" : "justify-center px-0 w-full"
                                )}
                            >
                                <LayoutGrid className={cn(
                                    "w-5 h-5 transition-colors",
                                    isSidebarOpen ? "mr-3" : "mr-0",
                                    isActive('/dashboard/factories') || isInDashboardsSection
                                        ? 'text-[var(--color-primary)]'
                                        : 'text-[var(--color-text-subtle)]'
                                )} />
                                <span className={cn(
                                    "transition-all duration-300 overflow-hidden whitespace-nowrap text-left flex-1",
                                    isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0 hidden"
                                )}>My Dashboards</span>
                            </button>

                            {/* Right: Toggle Dropdown Button */}
                            <button
                                onClick={() => setIsDashboardsExpanded(!isDashboardsExpanded)}
                                className={cn(
                                    "px-3 py-2.5 transition-colors hover:bg-[var(--color-border)]/30",
                                    isActive('/dashboard/factories') || isInDashboardsSection
                                        ? 'text-[var(--color-text)]'
                                        : 'text-[var(--color-text-muted)]',
                                    !isSidebarOpen && "hidden"
                                )}
                                aria-label={isDashboardsExpanded ? 'Collapse dashboards' : 'Expand dashboards'}
                            >
                                <ChevronDown
                                    className={`w-4 h-4 transition-transform ${isDashboardsExpanded ? 'rotate-180' : ''}`}
                                />
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
                                        <span>Show {dashboards.filter(d => d.id !== 'default').length - INITIAL_DASHBOARD_LIMIT} more</span>
                                        <ChevronDown className="w-3 h-3 ml-1" />
                                    </button>
                                )}

                                {showAllDashboards && (
                                    <button
                                        onClick={() => setShowAllDashboards(false)}
                                        className="w-full flex items-center justify-center px-4 py-2 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 transition-colors"
                                    >
                                        <span>Show less</span>
                                        <ChevronDown className="w-3 h-3 ml-1 transform rotate-180" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* <a href="#"
                        title={!isSidebarOpen ? "Data Import" : undefined}
                        className={cn(
                            "flex items-center py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors border-l-4 border-transparent",
                            isSidebarOpen ? "px-4" : "justify-center px-0 border-l-0"
                        )}>
                        <svg className={cn("w-5 h-5", isSidebarOpen ? "mr-3" : "mr-0", "text-[var(--color-success)]")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className={cn(
                            "transition-all duration-300 overflow-hidden whitespace-nowrap",
                            isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                        )}>Data Import</span>
                    </a> */}
                    {/*
                    <a href="#"
                        title={!isSidebarOpen ? "Discrepancies" : undefined}
                        className={cn(
                            "flex items-center py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors border-l-4 border-transparent",
                            isSidebarOpen ? "px-4" : "justify-center px-0 border-l-0"
                        )}>
                        <svg className={cn("w-5 h-5", isSidebarOpen ? "mr-3" : "mr-0", "text-[var(--color-warning)]")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className={cn(
                            "transition-all duration-300 overflow-hidden whitespace-nowrap",
                            isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                        )}>Discrepancies</span>
                        {isSidebarOpen && (
                            <span className="ml-auto bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-xs px-2 py-0.5 rounded-full font-bold">3</span>
                        )}
                    </a>
                    */}

                    {/*
                    <div className={cn("px-4 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-2 mt-6", !isSidebarOpen && "hidden")}>Analytics</div>

                    <a href="#"
                        title={!isSidebarOpen ? "Workforce Ranking" : undefined}
                        className={cn(
                            "flex items-center py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors border-l-4 border-transparent",
                            isSidebarOpen ? "px-4" : "justify-center px-0 border-l-0"
                        )}>
                        <svg className={cn("w-5 h-5", isSidebarOpen ? "mr-3" : "mr-0", "text-[var(--color-text-muted)]")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className={cn(
                            "transition-all duration-300 overflow-hidden whitespace-nowrap",
                            isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                        )}>Workforce Ranking</span>
                    </a>
                    <a href="#"
                        title={!isSidebarOpen ? "Line Performance" : undefined}
                        className={cn(
                            "flex items-center py-2.5 text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors border-l-4 border-transparent",
                            isSidebarOpen ? "px-4" : "justify-center px-0 border-l-0"
                        )}>
                        <svg className={cn("w-5 h-5", isSidebarOpen ? "mr-3" : "mr-0", "text-[var(--color-text-muted)]")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span className={cn(
                            "transition-all duration-300 overflow-hidden whitespace-nowrap",
                            isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                        )}>Line Performance</span>
                    </a>

                    {/* Team Management - Owner Only */}
                    {isOwner && (
                        <>
                            <div className={cn("px-4 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-2 mt-6", !isSidebarOpen && "hidden")}>Organization</div>
                            <button
                                onClick={() => navigate('/organization/settings')}
                                title={!isSidebarOpen ? "Team" : undefined}
                                className={cn(
                                    "w-full flex items-center py-2.5 text-sm font-semibold border-l-4 transition-colors",
                                    isActive('/organization/settings') || location.pathname.startsWith('/organization/settings')
                                        ? 'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-text)]'
                                        : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20',
                                    isSidebarOpen ? "px-4" : "justify-center px-0 border-l-0"
                                )}
                            >
                                <Users className={cn("w-5 h-5 flex-shrink-0", isSidebarOpen ? "mr-3" : "mr-0", (isActive('/organization/settings') || location.pathname.startsWith('/organization/settings')) ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]')} />
                                <span className={cn(
                                    "transition-all duration-300 overflow-hidden whitespace-nowrap text-left flex-1",
                                    isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                                )}>Organization</span>
                            </button>
                        </>
                    )}
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
                    <button
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
                    </button>
                </div>
            </aside >
        </>
    );
};

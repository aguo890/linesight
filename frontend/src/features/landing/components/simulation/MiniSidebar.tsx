import React from 'react';
import { LayoutGrid, ChevronDown, PanelLeft, Users } from 'lucide-react';
import { Logo } from '../../../../components/common/Logo';
import { cn } from '../../../../lib/utils';

export const MiniSidebar: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
    // Static state for simulation - visual only
    const [isDashboardsExpanded] = React.useState(true);

    return (
        <aside className={cn(
            "absolute top-0 left-0 bottom-0 z-10 border-r flex flex-col shrink-0 transition-all duration-300 ease-in-out w-64",
            isDark ? "bg-surface-elevated border-border-dark" : "bg-surface-elevated border-border"
        )}>
            {/* BRAND SECTION */}
            <div className={cn(
                "flex items-center justify-between px-6 h-16 border-b transition-colors duration-300",
                isDark ? "border-border-dark" : "border-border"
            )}>
                <div className="flex items-center group justify-center">
                    <Logo variant="app" showText={true} />
                </div>
                {/* Fake toggle */}
                <button
                    className={cn(
                        "p-1.5 rounded-md transition-colors",
                        isDark ? "text-text-muted hover:text-text-inverted hover:bg-border-dark/20" : "text-text-muted hover:text-text-main hover:bg-border/20"
                    )}
                >
                    <PanelLeft className="w-4 h-4" />
                </button>
            </div>

            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                {/* My Dashboards - Simulation */}
                <div>
                    <div className={cn(
                        "w-full flex items-center border-l-4 transition-colors bg-surface border-brand"
                    )}>
                        <button className={cn(
                            "flex items-center py-2.5 text-sm font-semibold transition-colors flex-1 px-4 text-text-main"
                        )}>
                            <LayoutGrid className="w-5 h-5 transition-colors mr-3 text-brand" />
                            <span className="transition-all duration-300 opacity-100 max-w-[200px] text-left">My Dashboards</span>
                        </button>
                        <button className={cn(
                            "px-3 py-2.5 transition-colors text-text-main"
                        )}>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", isDashboardsExpanded && "rotate-180")} />
                        </button>
                    </div>

                    {isDashboardsExpanded && (
                        <div className={cn(
                            "mt-1 ml-4 space-y-0.5 border-l-2",
                            isDark ? "border-border-dark" : "border-border"
                        )}>
                            <button className={cn(
                                "w-full flex items-center pl-4 pr-4 py-2 text-sm transition-colors text-text-muted hover:bg-surface-dark-hover hover:text-text-inverted"
                            )}>
                                <span className="flex-1 truncate text-left">Detroit Assembly</span>
                                <span className="text-xs text-text-muted">3</span>
                            </button>
                            <button className={cn(
                                "w-full flex items-center pl-4 pr-4 py-2 text-sm transition-colors text-text-muted hover:bg-surface-dark-hover hover:text-text-inverted"
                            )}>
                                <span className="flex-1 truncate text-left">Shanghai Electronics</span>
                                <span className="text-xs text-text-muted">5</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className={cn(
                    "px-4 text-xs font-bold uppercase tracking-wider mb-2 mt-6",
                    isDark ? "text-text-muted" : "text-text-muted"
                )}>Organization</div>
                <button className={cn(
                    "w-full flex items-center py-2.5 text-sm font-semibold border-l-4 transition-colors border-transparent px-4 text-text-muted hover:bg-border/20"
                )}>
                    <Users className="w-5 h-5 flex-shrink-0 mr-3 text-text-muted" />
                    <span>Organization</span>
                </button>
            </nav>

            <div className={cn(
                "p-4 border-t space-y-3",
                isDark ? "border-border-dark" : "border-border"
            )}>
                {/* Footer spacer */}
            </div>
        </aside>
    );
};

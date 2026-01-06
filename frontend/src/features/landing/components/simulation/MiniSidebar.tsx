import React from 'react';
import { LayoutGrid, ChevronDown, PanelLeft } from 'lucide-react';
import { Logo } from '../../../../components/common/Logo';
import { cn } from '../../../../lib/utils';

export const MiniSidebar: React.FC = () => {
    // Static state for simulation - visual only

    return (
        <aside className={cn(
            "absolute top-0 left-0 bottom-0 z-10 bg-[var(--color-surface-elevated)] border-r border-[var(--color-border)] flex flex-col shrink-0 transition-all duration-300 ease-in-out",
            "w-64"
        )}>
            {/* BRAND SECTION */}
            <div className="flex items-center justify-between px-6 h-16 border-b border-[var(--color-border)]">
                <div className="flex items-center group justify-center">
                    <Logo variant="app" showText={true} />
                </div>
                {/* Fake toggle */}
                <button
                    className="p-1.5 rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors"
                >
                    <PanelLeft className="w-4 h-4" />
                </button>
            </div>

            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                {/* Overview */}
                <button
                    className={cn(
                        "w-full flex items-center py-2.5 text-sm font-semibold border-l-4 transition-colors px-4",
                        'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-text)]'
                    )}
                >
                    <svg className="w-5 h-5 flex-shrink-0 mr-3 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="transition-all duration-300 opacity-100 max-w-[200px]">Overview</span>
                </button>

                {/* My Dashboards - Simulation */}
                <div>
                    <div className="w-full flex items-center border-l-4 transition-colors border-transparent hover:bg-[var(--color-border)]/20">
                        <button className="flex items-center py-2.5 text-sm font-semibold transition-colors text-[var(--color-text-muted)] flex-1 px-4">
                            <LayoutGrid className="w-5 h-5 transition-colors mr-3 text-[var(--color-text-subtle)]" />
                            <span className="transition-all duration-300 opacity-100 max-w-[200px] text-left">My Dashboards</span>
                        </button>
                        <button className="px-3 py-2.5 transition-colors hover:bg-[var(--color-border)]/30 text-[var(--color-text-muted)]">
                            <ChevronDown className="w-4 h-4 transition-transform rotate-180" />
                        </button>
                    </div>

                    <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[var(--color-border)]">
                        <button className="w-full flex items-center pl-4 pr-4 py-2 text-sm transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 hover:text-[var(--color-text)]">
                            <span className="flex-1 truncate text-left">Detroit Assembly</span>
                            <span className="text-xs text-[var(--color-text-subtle)]">3</span>
                        </button>
                        <button className="w-full flex items-center pl-4 pr-4 py-2 text-sm transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 hover:text-[var(--color-text)]">
                            <span className="flex-1 truncate text-left">Shanghai Electronics</span>
                            <span className="text-xs text-[var(--color-text-subtle)]">5</span>
                        </button>
                    </div>
                </div>

                <a href="#" className="flex items-center py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors border-l-4 border-transparent px-4">
                    <svg className="w-5 h-5 mr-3 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="transition-all duration-300 opacity-100 max-w-[200px]">Data Import</span>
                </a>

                <div className="px-4 text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-2 mt-6">Analytics</div>
                <a href="#" className="flex items-center py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-border)]/20 transition-colors border-l-4 border-transparent px-4">
                    <svg className="w-5 h-5 mr-3 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Workforce Ranking</span>
                </a>
            </nav>
        </aside>
    );
};

import React from 'react';

import {
    useGetOverviewStatsApiV1AnalyticsOverviewGet,
} from '../../../api/endpoints/analytics/analytics';
import type { OverviewStats } from '../../../api/model';
import { MainLayout } from '@/components/layout/MainLayout';

// Default/fallback data
const defaultStats: OverviewStats = {
    total_output: 14205,
    output_change_pct: '5.2',
    avg_efficiency: '87.4',
    efficiency_change_pct: '-1.2',
    discrepancies_count: 3,
    active_lines: 4,
    total_lines: 6,
    last_updated: '15 mins ago',
};

const DashboardPage: React.FC = () => {
    // Use Orval React Query Hooks
    const { data: statsData } = useGetOverviewStatsApiV1AnalyticsOverviewGet();

    // Derived state with fallback to default data
    const stats = statsData || defaultStats;



    return (
        <MainLayout>
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--color-text)]">Production Overview</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">Data compiled from 12 uploaded sheets. Last updated 15 mins ago.</p>
                </div>
                {/* <button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-2 rounded-sm text-sm font-medium shadow-sm transition flex items-center">
                    <svg className="w-4 h-4 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Excel Sheet
                </button> */}
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--color-surface)] p-4 rounded-sm border border-[var(--color-border)] shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Total Output</p>
                            <h3 className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.total_output.toLocaleString()} <span className="text-sm font-normal text-[var(--color-text-subtle)]">units</span></h3>
                        </div>
                        <span className={`${parseFloat(stats.output_change_pct) >= 0 ? 'text-[var(--color-success)] bg-[var(--color-success-bg)]' : 'text-[var(--color-danger)] bg-[var(--color-danger-bg)]'} px-2 py-0.5 rounded text-xs font-bold`}>{parseFloat(stats.output_change_pct) >= 0 ? '+' : ''}{stats.output_change_pct}%</span>
                    </div>
                </div>
                <div className="bg-[var(--color-surface)] p-4 rounded-sm border border-[var(--color-border)] shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Avg. Efficiency</p>
                            <h3 className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.avg_efficiency}%</h3>
                        </div>
                        <span className={`${parseFloat(stats.efficiency_change_pct) >= 0 ? 'text-[var(--color-success)] bg-[var(--color-success-bg)]' : 'text-[var(--color-danger)] bg-[var(--color-danger-bg)]'} px-2 py-0.5 rounded text-xs font-bold`}>{parseFloat(stats.efficiency_change_pct) >= 0 ? '+' : ''}{stats.efficiency_change_pct}%</span>
                    </div>
                </div>
                <div className="bg-[var(--color-surface)] p-4 rounded-sm border border-[var(--color-border)] border-s-4 border-s-[var(--color-warning)] shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Discrepancies</p>
                            <h3 className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.discrepancies_count} <span className="text-sm font-normal text-[var(--color-text-subtle)]">alerts</span></h3>
                        </div>
                        <svg className="w-5 h-5 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                </div>
                <div className="bg-[var(--color-surface)] p-4 rounded-sm border border-[var(--color-border)] shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Active Lines</p>
                            <h3 className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.active_lines} <span className="text-sm font-normal text-[var(--color-text-subtle)]">/ {stats.total_lines} running</span></h3>
                        </div>
                        <svg className="w-5 h-5 text-[var(--color-text-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Chart Card */}
                    <div className="bg-[var(--color-surface)] p-5 rounded-sm border border-[var(--color-border)] shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-[var(--color-text)]">Production vs. Target (Last 7 Days)</h3>
                            <select className="text-xs border border-[var(--color-border)] rounded p-1 text-[var(--color-text-muted)] outline-none">
                                <option>All Lines</option>
                                <option>Line A</option>
                                <option>Line B</option>
                            </select>
                        </div>
                        <div className="h-64 flex items-center justify-center bg-[var(--color-background)]/50 rounded border border-transparent">
                            {/* ProductionChart is a Smart Widget - use Dashboard view for real charts */}
                            <div className="text-center text-[var(--color-text-muted)]">
                                <p className="text-sm">Chart visualization available in Dashboard view</p>
                            </div>
                        </div>
                    </div>

                    {/* Discrepancy Table */}
                    <div className="bg-[var(--color-surface)] rounded-sm border border-[var(--color-border)] shadow-sm overflow-hidden">
                        <div className="bg-[var(--color-surface-elevated)] px-5 py-3 border-b border-[var(--color-border)] flex justify-between items-center">
                            <h3 className="font-semibold text-[var(--color-text)] text-sm">Detected Discrepancies (AI Analysis)</h3>
                            <button className="text-xs text-[var(--color-primary)] hover:underline">View All</button>
                        </div>
                        <table className="w-full text-sm text-start">
                            <thead className="text-xs text-[var(--color-text-muted)] uppercase bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)]">
                                <tr>
                                    <th className="px-5 py-3">Severity</th>
                                    <th className="px-5 py-3">Issue</th>
                                    <th className="px-5 py-3">Source File</th>
                                    <th className="px-5 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] transition-colors">
                                    <td className="px-5 py-3">
                                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-bold">High</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="font-medium text-[var(--color-text)]">Count Mismatch</div>
                                        <div className="text-xs text-[var(--color-text-muted)]">Line 3 reported 10% more output than raw material allowed.</div>
                                    </td>
                                    <td className="px-5 py-3 font-mono text-xs text-[var(--color-text-muted)]">Shift_Report_Oct22.xlsx</td>
                                    <td className="px-5 py-3">
                                        <button className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium">Investigate</button>
                                    </td>
                                </tr>
                                <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] transition-colors">
                                    <td className="px-5 py-3">
                                        <span className="bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-xs px-2 py-1 rounded font-bold">Medium</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="font-medium text-[var(--color-text)]">Missing Operator ID</div>
                                        <div className="text-xs text-[var(--color-text-muted)]">Shift 2 data contains null values for operator.</div>
                                    </td>
                                    <td className="px-5 py-3 font-mono text-xs text-[var(--color-text-muted)]">Prod_Line_2_FINAL.xlsx</td>
                                    <td className="px-5 py-3">
                                        <button className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium">Fix Data</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column Widgets */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Placeholder or Empty Right Column */}
                </div>
            </div>
        </MainLayout>
    );
};

export default DashboardPage;

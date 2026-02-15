/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { MiniSidebar } from './MiniSidebar';
import { MiniTopNav } from './MiniTopNav';
import LineEfficiencyGauge from '@/features/dashboard/widgets/LineEfficiencyGauge';
import { MockEarnedMinutesWidget } from './MockEarnedMinutesWidget';
import ProductionChart from '@/features/dashboard/widgets/ProductionChart';

interface MiniDashboardProps {
    demoEfficiencyData: any;
    demoEarnedMinutesData: any;
    demoProductionData: any;
    isDark?: boolean;
}

export const MiniDashboard: React.FC<MiniDashboardProps> = ({ demoEfficiencyData, demoEarnedMinutesData, demoProductionData, isDark = false }) => {
    return (
        <div className={`relative w-[1280px] h-[800px] rounded-xl overflow-hidden shadow-2xl select-none pointer-events-none transition-colors duration-300 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
            {/* 1. Sidebar */}
            <MiniSidebar isDark={isDark} />

            {/* 2. Main Content Wrapper */}
            <div className="flex flex-col h-full">
                {/* 3. Top Nav */}
                <MiniTopNav isDark={isDark} />

                {/* 4. Dashboard Content Area */}
                <main className={`flex-1 ml-64 p-6 overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    {/* Header */}
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Assembly Line #4 Preview</h1>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Real-time monitoring enabled • Last update: just now</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Live System
                            </span>
                        </div>
                    </div>

                    {/* Widgets Grid */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* 1. Line Efficiency Gauge (Small/Square) */}
                        <div className={`col-span-12 md:col-span-4 h-[320px] rounded-2xl shadow-sm border overflow-hidden relative transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <LineEfficiencyGauge
                                w={3}
                                h={2}
                                data={demoEfficiencyData}
                                isLoading={false}
                                error={null}
                                isMock={true}
                                settings={{}}
                                globalFilters={{ dateRange: { start: new Date(), end: new Date() }, shift: 'All' }}
                            />
                        </div>

                        {/* 2. Earned Minutes (Medium) */}
                        <div className={`col-span-12 md:col-span-4 h-[320px] rounded-2xl shadow-sm border overflow-hidden relative transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <MockEarnedMinutesWidget w={3} h={2} data={demoEarnedMinutesData} isDark={isDark} />
                        </div>

                        {/* 3. Recent Activity / Timeline (Filling gap) */}
                        <div className={`col-span-12 md:col-span-4 h-[320px] rounded-2xl shadow-sm border p-6 transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Live Events
                            </h3>
                            <div className="space-y-4">
                                {[
                                    { time: '10:42 AM', event: 'Shift Target Met', type: 'success' },
                                    { time: '10:15 AM', event: 'Material Restock', type: 'neutral' },
                                    { time: '09:30 AM', event: 'Machine Maintenance', type: 'warning' },
                                    { time: '08:00 AM', event: 'Shift Started', type: 'neutral' }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-3 text-sm">
                                        <span className="text-slate-400 text-xs font-mono pt-0.5">{item.time}</span>
                                        <span className={`font-medium ${item.type === 'success' ? 'text-emerald-600' : item.type === 'warning' ? 'text-amber-600' : 'text-slate-600'}`}>
                                            {item.event}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 4. Production Chart (Wide/Bottom) */}
                        <div className={`col-span-12 h-[340px] rounded-2xl shadow-sm border overflow-hidden relative transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <ProductionChart
                                w={6}
                                h={4}
                                data={demoProductionData}
                                isLoading={false}
                                error={null}
                                isMock={true}
                                settings={{}}
                                globalFilters={{ dateRange: { start: new Date(), end: new Date() }, shift: 'All' }}
                            />
                        </div>
                    </div>
                </main>
            </div>

            {/* Overlay Gradient to fade out bottom */}
            <div className={`absolute bottom-0 left-0 w-full h-24 pointer-events-none ${isDark ? 'bg-gradient-to-t from-slate-900 to-transparent' : 'bg-gradient-to-t from-white to-transparent'}`} />
        </div>
    );
};

/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';
import { Target } from 'lucide-react';

interface MockTargetProps {
    w?: number;
    h?: number;
    data: {
        actual: number;
        target: number;
        percentage?: number;
    };
    isDark?: boolean;
}



export const MockTargetRealizationWidget: React.FC<MockTargetProps> = ({
    data, isDark = false
}) => {

    // Defaults
    const actual = data?.actual || 0;
    const target = data?.target || 0;
    const percentage = data?.percentage || (target > 0 ? Math.round((actual / target) * 100) : 0);
    const isBehind = percentage < 90;

    const chartData = [
        { name: 'Today', actual: actual, target: target }
    ];

    const percentBadge = (
        <div className={`px-2 py-1 rounded text-xs font-bold ${percentage >= 100
            ? 'bg-emerald-500/10 text-emerald-500'
            : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            {percentage}%
        </div>
    );

    return (
        <div className={`flex flex-col h-full w-full p-4 rounded-xl shadow-sm border transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${isDark ? 'bg-sky-900/40' : 'bg-sky-50'}`}>
                        <Target className="w-4 h-4 text-sky-500" />
                    </div>
                    <div>
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Daily Target</h3>
                        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Real-time Realization</div>
                    </div>
                </div>
                {percentBadge}
            </div>

            <div className="flex-1 w-full min-h-0 flex flex-col justify-between h-full">
                {/* Main Content */}
                <div className="flex-1 flex flex-col justify-center">
                    {/* Main Bullet Chart */}
                    <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" hide />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="actual" barSize={24} radius={[0, 4, 4, 0]}>
                                    <Cell fill={percentage >= 100 ? '#10b981' : (isBehind ? '#f59e0b' : '#3b82f6')} />
                                </Bar>
                                <ReferenceLine x={target} stroke="black" strokeWidth={2} label={{ position: 'top', value: 'Goal', fontSize: 10, fill: '#64748b' }} strokeDasharray="3 3" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className={`flex justify-between mt-2 px-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        <div className="flex flex-col">
                            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Actual</span>
                            <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{actual ? actual.toLocaleString() : '0'}</div>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Target</span>
                            <div className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Target: {target ? target.toLocaleString() : '0'}</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

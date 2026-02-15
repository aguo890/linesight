/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SmartWidgetProps } from '../config';
import { ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { z } from 'zod';
import { SamPerformanceDataSchema } from '../registry';

// Schema-inferred types
type SamData = z.infer<typeof SamPerformanceDataSchema>;

interface SamSettings {
    customTitle?: string;
}

const SamPerformanceMetric: React.FC<SmartWidgetProps<SamData, SamSettings>> = ({
    data,
    h
}) => {
    const { t } = useTranslation();
    // Determine layout
    // const density = getDensity(w, h); // We don't need density for wrapper anymore, but might check for compact layout
    const isCompact = (h || 0) <= 2;

    const rawData = data;

    // Derived State
    const isPositive = (rawData?.efficiency_change || 0) >= 0;
    const efficiency = rawData?.efficiency || 0;
    const change = Math.abs(rawData?.efficiency_change || 0);

    return (
        <div className="flex flex-col h-full">
            {/* Metric Header */}
            <div className="flex items-baseline gap-2 mb-2 px-1">
                <span className={isCompact ? "text-2xl font-bold text-text-main" : "text-3xl font-bold text-text-main"}>
                    {efficiency}%
                </span>
                <span className={`text-xs font-medium ${isPositive ? "text-success" : "text-danger"}`}>
                    {isPositive ? "↑" : "↓"} {change}%
                </span>
            </div>

            {/* Chart Area */}
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rawData?.breakdown || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-text-main)'
                            }}
                            cursor={{ fill: 'var(--color-surface-subtle)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar
                            dataKey="actual"
                            name={t('widgets.common.actual')}
                            fill="#8b5cf6"
                            radius={[4, 4, 0, 0]}
                            barSize={20}
                        />
                        <Line
                            type="monotone"
                            dataKey="standard"
                            name={t('widgets.common.target')}
                            stroke="#fb923c"
                            strokeWidth={2}
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SamPerformanceMetric;

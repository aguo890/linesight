import React from 'react';
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
    settings,
    w,
    h
}) => {
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
                <span className={isCompact ? "text-2xl font-bold text-gray-900" : "text-3xl font-bold text-gray-900"}>
                    {efficiency}%
                </span>
                <span className={`text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                    {isPositive ? "↑" : "↓"} {change}%
                </span>
            </div>

            {/* Chart Area */}
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rawData?.breakdown || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar
                            dataKey="actual"
                            name="Actual"
                            fill="#8b5cf6"
                            radius={[4, 4, 0, 0]}
                            barSize={20}
                        />
                        <Line
                            type="monotone"
                            dataKey="standard"
                            name="Target"
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

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { SmartWidgetProps } from '../config';
import { z } from 'zod';
import { DhuQualityDataSchema } from '../registry';
import { useThemeColors } from '@/hooks/useThemeColor';

// Input type inferred from Zod Schema
type DhuData = z.infer<typeof DhuQualityDataSchema>;

interface DhuQualitySettings {
    maxAcceptableDHU?: number;
    showThresholdLine?: boolean;
    customTitle?: string;
    refreshRate?: number;
}

export const DhuQualityChart: React.FC<SmartWidgetProps<DhuData, DhuQualitySettings>> = ({
    data,
    settings,
    w: _w,
    h: _h
}) => {
    // Extract settings with defaults
    const maxAcceptableDHU = settings?.maxAcceptableDHU ?? 2.5;
    const showThresholdLine = settings?.showThresholdLine ?? true;

    // Theme Colors for Dark Mode Support
    const themeColors = useThemeColors(['--text-muted', '--border', '--surface']);
    const gridColor = themeColors['--border'];
    const axisColor = themeColors['--text-muted'];
    const tooltipBg = themeColors['--surface'];

    // Handle new API response shape: Array of { date, dhu } objects
    // (API returns array directly, not object with .history)
    const chartData = useMemo(() => {
        if (Array.isArray(data)) {
            return data;
        }
        // Legacy format fallback
        return (data as any)?.history || [];
    }, [data]);

    // Compute current DHU from latest entry
    const currentDhu = useMemo(() => {
        if (Array.isArray(data) && data.length > 0) {
            // Get the last entry's dhu value
            const lastEntry = data[data.length - 1];
            return typeof lastEntry.dhu === 'number' ? lastEntry.dhu : 0;
        }
        // Legacy format fallback
        return (data as any)?.currentDhu ?? 0;
    }, [data]);

    const isAboveThreshold = currentDhu > maxAcceptableDHU;

    // Handle empty data gracefully
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return (
            <div className="flex h-full items-center justify-center text-text-muted text-sm">
                No Quality Data
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full p-4 space-y-3">
            {/* Current DHU Summary */}
            <div className="flex justify-between items-end">
                <div>
                    <span className={`text-2xl font-bold ${isAboveThreshold ? 'text-danger' : 'text-text-main'}`}>
                        {currentDhu.toFixed(2)}%
                    </span>
                    <span className="text-xs text-text-muted ml-2">Current DHU</span>
                </div>
                {isAboveThreshold && (
                    <span className="text-xs font-medium text-danger bg-danger/10 px-2 py-0.5 rounded animate-pulse">
                        Above Limit
                    </span>
                )}
            </div>

            {/* Trend Chart */}
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: axisColor }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: axisColor }}
                            tickLine={false}
                            axisLine={false}
                            unit="%"
                            domain={[0, 'auto']}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid var(--color-border)',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                backgroundColor: tooltipBg,
                                color: 'var(--color-text-main)'
                            }}
                            labelStyle={{ color: 'var(--color-text-main)', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}
                            cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: '5 5' }}
                        />
                        {showThresholdLine && (
                            <ReferenceLine
                                y={maxAcceptableDHU}
                                stroke="#f97316"
                                strokeDasharray="3 3"
                                label={{ value: 'Limit', position: 'right', fontSize: 9, fill: '#f97316' }}
                            />
                        )}
                        <Line
                            type="monotone"
                            dataKey="dhu"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#ef4444' }}
                            activeDot={{ r: 5 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DhuQualityChart;

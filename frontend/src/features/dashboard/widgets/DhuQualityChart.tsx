/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChartDirectionIsolator } from '@/components/common/ChartDirectionIsolator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { SmartWidgetProps } from '../config';
import { z } from 'zod';
import { DhuQualityDataSchema } from '../registry';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useFactoryFormat } from '@/hooks/useFactoryFormat';

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
    const { t } = useTranslation();
    const { formatDate } = useFactoryFormat();


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
                {t('widgets.dhu_quality.no_data')}
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
                    <span className="text-xs text-text-muted ms-2">{t('widgets.dhu_quality.current_dhu')}</span>
                </div>
                {isAboveThreshold && (
                    <span className="text-xs font-medium text-danger bg-danger/10 px-2 py-0.5 rounded animate-pulse">
                        {t('widgets.dhu_quality.above_limit')}
                    </span>
                )}
            </div>

            {/* Trend Chart */}
            <div className="flex-1 min-h-0">
                <ChartDirectionIsolator>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{
                            top: 5,
                            right: 5,
                            bottom: 5,
                            left: -20
                        }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: axisColor }}
                                tickLine={false}
                                axisLine={false}
                                reversed={false}
                                tickFormatter={(val) => formatDate(val)}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: axisColor }}
                                tickLine={false}
                                axisLine={false}
                                unit="%"
                                domain={[0, 'auto']}
                                orientation="left"
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    backgroundColor: tooltipBg,
                                    color: 'var(--color-text-main)',
                                    textAlign: 'inherit'
                                }}
                                labelStyle={{ color: 'var(--color-text-main)', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}
                                itemStyle={{ textAlign: 'inherit' }}
                                cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: '5 5' }}
                                labelFormatter={(label) => formatDate(label)}
                            />
                            {showThresholdLine && (
                                <ReferenceLine
                                    y={maxAcceptableDHU}
                                    stroke="#f97316"
                                    strokeDasharray="3 3"
                                    label={{
                                        value: t('widgets.common.limit'),
                                        position: 'right',
                                        fontSize: 9,
                                        fill: '#f97316'
                                    }}
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
                </ChartDirectionIsolator>
            </div>
        </div>
    );
};

export default DhuQualityChart;

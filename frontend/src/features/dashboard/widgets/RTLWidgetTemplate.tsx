/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { ChartDirectionIsolator } from '@/components/common/ChartDirectionIsolator';
import type { SmartWidgetProps } from '../config';
import { useThemeColors } from '@/hooks/useThemeColor';
import { z } from 'zod';

// --- 1. Define Schema for Type Safety (Replace with your actual Registry Schema) ---
const WidgetDataSchema = z.object({
    data_points: z.array(z.object({
        label: z.string(),
        value: z.number(),
        target: z.number().optional()
    }))
});

type WidgetData = z.infer<typeof WidgetDataSchema>;

interface WidgetSettings {
    showLegend?: boolean;
    customTitle?: string;
}

// --- 2. The Component ---
const RTLWidgetTemplate: React.FC<SmartWidgetProps<WidgetData, WidgetSettings>> = ({
    data,
    settings
}) => {
    // A. Hook into i18n for RTL Detection (Text only)
    const { i18n } = useTranslation();
    const isRTL = i18n.dir() === 'rtl';

    // B. Hooks for Formatting and Theming
    const themeColors = useThemeColors(['--text-main', '--text-muted', '--border', '--surface', '--color-primary', '--color-danger']);

    // Process Data
    const chartData = data?.data_points || [];
    const showLegend = settings?.showLegend ?? true;

    // Helper for number formatting since useFactoryFormat doesn't provide it yet
    const formatNumber = (val: number) => new Intl.NumberFormat(i18n.language).format(val);

    return (
        // C. Container must be full width/height for Grid
        <div className="flex flex-col w-full h-full relative">
            {/* Header with Directional Icon Example */}
            <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="font-semibold">{settings?.customTitle || 'Widget Title'}</h3>
                {/* STANDARD: Rotate directional icons 180deg in RTL */}
                <ArrowRight
                    size={16}
                    className={`text-slate-400 transition-transform ${isRTL ? 'rotate-180' : ''}`}
                />
            </div>

            <div className="flex-1 min-h-0 w-full relative">
                {/* D. Charts are ALWAYS LTR */}
                <ChartDirectionIsolator>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            margin={{
                                top: 10,
                                right: 10,
                                bottom: 0,
                                left: -10
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors['--border']} />

                            {/* E. X-Axis: Standard LTR */}
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10, fill: themeColors['--text-muted'] }}
                                axisLine={false}
                                tickLine={false}
                                reversed={false}
                            />

                            {/* F. Y-Axis: Standard Left */}
                            <YAxis
                                orientation="left"
                                tick={{ fontSize: 10, fill: themeColors['--text-main'] }}
                                axisLine={false}
                                tickLine={false}
                            />

                            {/* G. Tooltip: Inherit LTR but allow content flow if needed */}
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: themeColors['--surface'],
                                    color: themeColors['--text-main'],
                                    textAlign: 'inherit'
                                }}
                                itemStyle={{
                                    textAlign: 'inherit'
                                }}
                                formatter={(value: number | undefined) => [value != null ? formatNumber(value) : '', 'Value']}
                            />

                            {/* H. Legend: LTR */}
                            {showLegend && <Legend
                                wrapperStyle={{
                                    fontSize: '11px',
                                    paddingTop: '5px',
                                    direction: 'ltr'
                                }}
                            />}

                            <Bar
                                dataKey="value"
                                name={'Value'}
                                fill={themeColors['--color-primary']}
                                radius={[4, 4, 0, 0]}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartDirectionIsolator>
            </div>
        </div>
    );
};

export default RTLWidgetTemplate;

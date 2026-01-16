import React from 'react';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { SmartWidgetProps } from '../config';
import { useFactoryFormat } from '@/hooks/useFactoryFormat';
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
    // A. Hook into i18n for RTL Detection
    const { t, i18n } = useTranslation();
    const isRTL = i18n.dir() === 'rtl';

    // B. Hooks for Formatting and Theming
    const { formatDate } = useFactoryFormat();
    const themeColors = useThemeColors(['--text-main', '--text-muted', '--border', '--surface', '--color-primary', '--color-danger']);

    // Process Data
    const chartData = data?.data_points || [];
    const showLegend = settings?.showLegend ?? true;

    // Helper for number formatting since useFactoryFormat doesn't provide it yet
    const formatNumber = (val: number) => new Intl.NumberFormat(i18n.language).format(val);

    return (
        // C. Container must be full width/height for Grid
        <div className="flex-1 min-h-0 w-full relative" style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: isRTL ? -10 : 10, // D. Flip Margins
                        bottom: 0,
                        left: isRTL ? 10 : -10
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors['--border']} />

                    {/* E. X-Axis: Reversed in RTL */}
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: themeColors['--text-muted'] }}
                        axisLine={false}
                        tickLine={false}
                        reversed={isRTL}
                    />

                    {/* F. Y-Axis: Flip Orientation */}
                    <YAxis
                        orientation={isRTL ? 'right' : 'left'}
                        tick={{ fontSize: 10, fill: themeColors['--text-main'] }}
                        axisLine={false}
                        tickLine={false}
                    />

                    {/* G. Tooltip: Align Text */}
                    <Tooltip
                        contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: themeColors['--surface'],
                            color: themeColors['--text-main'],
                            textAlign: isRTL ? 'right' : 'left' // <-- Critical for RTL text
                        }}
                        itemStyle={{
                            textAlign: isRTL ? 'right' : 'left'
                        }}
                        formatter={(value: number) => [formatNumber(value), 'Value']}
                    />

                    {/* H. Legend: Flip Direction */}
                    {showLegend && <Legend
                        wrapperStyle={{
                            fontSize: '11px',
                            paddingTop: '5px',
                            direction: isRTL ? 'rtl' : 'ltr'
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
        </div>
    );
};

export default RTLWidgetTemplate;

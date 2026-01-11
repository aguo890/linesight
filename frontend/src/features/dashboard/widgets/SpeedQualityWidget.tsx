import React from 'react';
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { SmartWidgetProps } from '../config';
import { SpeedQualityDataSchema } from '../registry';
import { z } from 'zod';
import { useFactoryFormat } from '@/hooks/useFactoryFormat';
import { useThemeColors } from '@/hooks/useThemeColor';

// Infer types from the Registry Schema
type SpeedQualityData = z.infer<typeof SpeedQualityDataSchema>;

interface SpeedQualitySettings {
    showLegend?: boolean;
    customTitle?: string;
}

const SpeedQualityWidget: React.FC<SmartWidgetProps<SpeedQualityData, SpeedQualitySettings>> = ({
    data,
    settings
}) => {
    const showLegend = settings?.showLegend ?? true;
    const rawData = data;
    const { formatDate } = useFactoryFormat();

    // Theme Colors for Dark Mode Support
    const themeColors = useThemeColors(['--text-main', '--text-muted', '--border', '--surface']);
    const axisColor = themeColors['--text-muted'];
    const textMainColor = themeColors['--text-main'];
    const gridColor = themeColors['--border'];
    const tooltipBg = themeColors['--surface'];

    // Data Processing: Extract 'data_points' and map for Recharts
    // Schema guarantees { data_points: [...] }
    const chartData = (rawData?.data_points || []).map((d: any) => ({
        date: d.date,
        efficiency: Number(d.efficiency_pct),
        dhu: Number(d.defects_per_hundred)
    }));

    return (
        <div className="flex-1 min-h-0 w-full relative" style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => formatDate(val)}
                    />
                    {/* Left Axis: Efficiency */}
                    <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 10, fill: textMainColor }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                        unit="%"
                    />
                    {/* Right Axis: DHU */}
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10, fill: '#ef4444' }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 'auto']}
                    />
                    <Tooltip
                        contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            backgroundColor: tooltipBg,
                            color: axisColor
                        }}
                        labelStyle={{ color: axisColor, fontSize: '12px', marginBottom: '4px' }}
                        labelFormatter={(label) => formatDate(label)}
                    />
                    {showLegend && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />}

                    {/* Efficiency Area/Line */}
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="efficiency"
                        name="Efficiency"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                    />

                    {/* DHU Bar */}
                    <Bar
                        yAxisId="right"
                        dataKey="dhu"
                        name="Defect Rate (DHU)"
                        fill="#ef4444"
                        opacity={0.6}
                        barSize={20}
                        radius={[4, 4, 0, 0]}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SpeedQualityWidget;

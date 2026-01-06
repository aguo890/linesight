import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import type { SmartWidgetProps } from '../config';
import { StyleProgressDataSchema } from '../registry';
import { z } from 'zod';

// Infer Type
type StyleProgressData = z.infer<typeof StyleProgressDataSchema>;

interface StyleProgressSettings {
    showPercentage?: boolean;
    customTitle?: string;
}

const StyleProgressWidget: React.FC<SmartWidgetProps<StyleProgressData, StyleProgressSettings>> = ({
    data,
    settings
}) => {
    const showPercentage = settings?.showPercentage ?? true;
    const rawData = data;

    // Use Schema-validated data directly
    // Schema guarantees { active_styles: [...] }
    const chartData = (rawData?.active_styles || []).map((style: any) => ({
        ...style,
        // Ensure numbers for Recharts
        actual: Number(style.actual),
        target: Number(style.target)
    }));

    return (
        <div className="flex-1 min-h-0 w-full relative" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 5, right: 30, bottom: 0, left: 10 }}
                >
                    {/* Light Gray Grid for contrast with black text */}
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />

                    {/* Black Text for X Axis */}
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#000000' }} stroke="#000000" />

                    {/* Black Text for Y Axis Labels */}
                    <YAxis
                        dataKey="style_code"
                        type="category"
                        width={70}
                        tick={{ fontSize: 10, fontWeight: 500, fill: '#000000' }}
                        stroke="#000000"
                    />

                    <Tooltip
                        cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }} // Light purple hover tint
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', color: '#000000' }}
                        itemStyle={{ color: '#000000' }}
                    />

                    {/* Target Bar -> Blue */}
                    <Bar dataKey="target" stackId="a" fill="#3b82f6" barSize={15} radius={[0, 4, 4, 0]} />

                    {/* Actual Bar -> Purple */}
                    <Bar dataKey="actual" stackId="b" fill="#8b5cf6" barSize={15} radius={[0, 4, 4, 0]}>
                        {showPercentage && (
                            <LabelList
                                dataKey="actual"
                                position="right"
                                style={{ fontSize: 10, fill: '#000000' }} // Black text labels
                                formatter={(val: any) => val}
                            />
                        )}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default StyleProgressWidget;

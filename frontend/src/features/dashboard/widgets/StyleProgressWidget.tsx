/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { ChartDirectionIsolator } from '@/components/common/ChartDirectionIsolator';
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
    // const { i18n } = useTranslation();
    // const isRTL = i18n.dir() === 'rtl';

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
            <ChartDirectionIsolator>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 5, right: 30, bottom: 0, left: 10 }}
                    >
                        {/* Grid for contrast */}
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />

                        {/* X Axis */}
                        <XAxis
                            type="number"
                            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                            stroke="var(--color-border)"
                            reversed={false}
                        />

                        {/* Y Axis Labels */}
                        <YAxis
                            dataKey="style_code"
                            type="category"
                            width={70}
                            tick={{ fontSize: 10, fontWeight: 500, fill: 'var(--color-text)' }}
                            stroke="var(--color-border)"
                            orientation="left"
                        />

                        <Tooltip
                            cursor={{ fill: 'var(--color-brand-faint)' }} // Light semantic hover tint
                            contentStyle={{
                                backgroundColor: 'var(--color-surface)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text)',
                                textAlign: 'inherit'
                            }}
                            itemStyle={{
                                color: 'var(--color-text)',
                                textAlign: 'inherit'
                            }}
                        />

                        {/* Target Bar -> Blue/Brand */}
                        <Bar dataKey="target" stackId="a" fill="#3b82f6" barSize={15} radius={[0, 4, 4, 0]} />

                        <Bar dataKey="actual" stackId="b" fill="#8b5cf6" barSize={15} radius={[0, 4, 4, 0]}>
                            {showPercentage && (
                                <LabelList
                                    dataKey="actual"
                                    position="right"
                                    style={{ fontSize: 10, fill: 'var(--color-text)' }}
                                    formatter={(val: any) => val}
                                />
                            )}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartDirectionIsolator>
        </div>
    );
};

export default StyleProgressWidget;

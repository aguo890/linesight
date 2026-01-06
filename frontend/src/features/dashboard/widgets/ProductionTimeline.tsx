import React, { useMemo } from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { SmartWidgetProps } from '../config';
import { TimelineDataSchema } from '../registry';
import { z } from 'zod';
import { useFactoryFormat } from '@/hooks/useFactoryFormat';

type TimelineData = z.infer<typeof TimelineDataSchema>;

interface ProductionTimelineSettings {
    showHourlyTarget?: boolean;
    hourlyTarget?: number;
    customTitle?: string;
}

const ProductionTimeline: React.FC<SmartWidgetProps<TimelineData, ProductionTimelineSettings>> = ({
    data,
    settings
}) => {
    const showHourlyTarget = settings?.showHourlyTarget ?? true;
    const manualTarget = settings?.hourlyTarget && settings.hourlyTarget > 0 ? settings.hourlyTarget : null;
    const { formatDate } = useFactoryFormat();

    // Normalize Data
    const chartData = useMemo(() => {
        if (!data) return [];
        if (Array.isArray(data)) {
            // Check if it's simple number array (backend format)
            if (data.length > 0 && typeof data[0] === 'number') {
                return (data as number[]).map((val, idx) => ({
                    time: `${idx + 8}:00`, // TODO: Logic Update Required - These hardcoded times (8:00) mimic UTC/Local but should eventually be derived from the Factory Timezone start-of-day.
                    actual: val,
                    target: manualTarget || 100 // Fallback or settings target
                }));
            }
            // Object array (Mock/Legacy)
            return data;
        }
        return [];
    }, [data, manualTarget]);

    return (
        <div className="flex-1 min-h-0 w-full" style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip labelFormatter={(value) => formatDate(value)} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '10px' }} />

                    <Bar dataKey="actual" name="Output" fill="#3b82f6" barSize={20} radius={[4, 4, 0, 0]} />

                    {showHourlyTarget && (
                        manualTarget ? (
                            <ReferenceLine y={manualTarget} stroke="#ef4444" strokeDasharray="3 3" label="Target" />
                        ) : (
                            <Line type="step" dataKey="target" name="Target" stroke="#ef4444" strokeDasharray="3 3" dot={false} />
                        )
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};
export default ProductionTimeline;

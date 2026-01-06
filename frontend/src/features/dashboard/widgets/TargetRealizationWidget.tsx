import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';
import { type SmartWidgetProps } from '../config';
import { TargetRealizationDataSchema } from '../registry';
import { z } from 'zod';

// Infer types
type TargetRealizationData = z.infer<typeof TargetRealizationDataSchema>;

interface TargetRealizationSettings {
    showVariance?: boolean;
    customTitle?: string;
}

const TargetRealizationWidget: React.FC<SmartWidgetProps<TargetRealizationData, TargetRealizationSettings>> = ({
    data,
    settings
}) => {
    // Extract settings with defaults
    const showVariance = settings?.showVariance ?? true;

    // Data handling (Schema should guarantee array or we handle it)
    const rawData = data;
    // Safe access: The schema defines it as array, but let's be safe
    const strictRecord = Array.isArray(rawData) ? (rawData.length > 0 ? rawData[0] : undefined) : rawData;

    const { actual, target, percentage } = strictRecord || {
        actual: 0,
        target: 0,
        percentage: 0
    };

    // If the backend doesn't send percentage, calculate it on the fly
    const displayPercentage = percentage || (target > 0 ? Math.round((actual / target) * 100) : 0);

    // Simple heuristic for "Behind" (if < 90% of target)
    const isBehind = displayPercentage < 90;

    const chartData = [
        { name: 'Today', actual: actual, target: target }
    ];

    return (
        <div className="flex-1 w-full min-h-0 flex flex-col justify-between h-full relative">
            {/* Status Badge (Moved from Header Action to Content Overlay) */}
            {showVariance && (
                <div className="absolute top-0 right-0 z-10">
                    <div className={`px-2 py-1 rounded text-xs font-bold ${displayPercentage >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {displayPercentage}%
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col justify-center pt-6"> {/* Added pt-6 for badge space */}
                {/* Main Bullet Chart */}
                <div className="h-16 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="actual" barSize={24} radius={[0, 4, 4, 0]}>
                                <Cell fill={displayPercentage >= 100 ? '#10b981' : (isBehind ? '#f59e0b' : '#3b82f6')} />
                            </Bar>
                            <ReferenceLine x={target} stroke="black" strokeWidth={2} label={{ position: 'top', value: 'Goal', fontSize: 10, fill: '#64748b' }} strokeDasharray="3 3" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex justify-between mt-2 text-xs text-slate-600 px-1">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">Actual</span>
                        <div className="text-3xl font-bold text-slate-900">{actual ? actual.toLocaleString() : '0'}</div>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-400">Target</span>
                        <div className="text-sm font-medium text-slate-500">Target: {target ? target.toLocaleString() : '0'}</div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TargetRealizationWidget;


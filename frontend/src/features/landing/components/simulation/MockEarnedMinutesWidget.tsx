import React from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Activity } from 'lucide-react';

interface MockWidgetProps {
    w?: number;
    h?: number;
    data: any;
    isDark?: boolean;
}

const getDensity = (w: number, h: number) => {
    if (w <= 2 || h <= 2) return 'compact';
    return 'normal';
};

export const MockEarnedMinutesWidget: React.FC<MockWidgetProps> = ({
    w = 3, h = 3, data: rawData, isDark = false
}) => {
    const density = getDensity(w, h);
    const isCompact = density === 'compact';
    const showEfficiency = true;

    // Normalize data
    const data = Array.isArray(rawData) ? { breakdown: rawData } : (rawData || { breakdown: [] });

    return (
        <div className={`flex flex-col h-full w-full p-4 transition-colors duration-300 ${isDark ? 'bg-[#1e1e1e] text-slate-100' : 'bg-white text-slate-900'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                        <Activity className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    </div>
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Earned Minutes</h3>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.breakdown || []} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} hide={!showEfficiency} />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', whiteSpace: 'nowrap' }} />

                        <Bar yAxisId="left" dataKey="earnedMinutes" name={isCompact ? "Earned" : "Earned Mins"} fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={isCompact ? 12 : 20} />
                        <Bar yAxisId="left" dataKey="availableMinutes" name={isCompact ? "Avail" : "Available Mins"} fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={isCompact ? 12 : 20} />

                        {showEfficiency && (
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="efficiency"
                                name="Eff %"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

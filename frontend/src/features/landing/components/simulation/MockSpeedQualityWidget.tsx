import React from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ZAxis, Cell
} from 'recharts';
import { Gauge } from 'lucide-react';

interface MockSpeedQualityProps {
    w?: number;
    h?: number;
    data: any[];
}

const getDensity = (w: number, h: number) => {
    if (w <= 2 || h <= 2) return 'compact';
    return 'normal';
};

export const MockSpeedQualityWidget: React.FC<MockSpeedQualityProps> = ({
    w = 3, h = 3, data
}) => {
    const density = getDensity(w, h);
    const showQuadrants = true;
    const qualityThreshold = 95;
    const speedThreshold = 85;

    // Use passed data
    const chartData = data || [];

    return (
        <div className="flex flex-col h-full w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md bg-indigo-50`}>
                        <Gauge className="w-4 h-4 text-indigo-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Speed vs Quality</h3>
                </div>
            </div>

            <div className="flex-1 min-h-0 w-full relative" style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            type="category"
                            dataKey="date"
                            name="Day"
                            tick={{ fontSize: 10 }}
                            interval={0}
                        />
                        <YAxis
                            type="number"
                            dataKey="efficiency_pct"
                            name="Efficiency"
                            unit="%"
                            domain={[80, 100]}
                            tick={{ fontSize: 10 }}
                        />
                        <ZAxis type="number" dataKey="defects_per_hundred" range={[50, 400]} name="Defects" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />

                        <Scatter name="Styles" data={chartData} fill="#8884d8">
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.efficiency_pct >= 90 ? '#22c55e' : '#ef4444'} />
                            ))}
                        </Scatter>

                        {showQuadrants && (
                            <ReferenceLine y={90} stroke="red" strokeDasharray="3 3" label={{ value: 'Target', position: 'insideTopRight', fontSize: 10, fill: 'red' }} />
                        )}
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

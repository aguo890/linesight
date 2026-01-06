import React from 'react';
import type { SmartWidgetProps } from '../config';
import { z } from 'zod';
import { LineEfficiencyDataSchema } from '../registry';

// Input type inferred from Zod Schema
type EfficiencyData = z.infer<typeof LineEfficiencyDataSchema>;

interface LineEfficiencySettings {
    targetPercentage?: number;
    showStatus?: boolean;
    customTitle?: string;
    refreshRate?: number;
}

const LineEfficiencyGauge: React.FC<SmartWidgetProps<EfficiencyData, LineEfficiencySettings>> = ({
    data,
    settings,
    w: _w,
    h
}) => {
    // Extract settings with defaults
    const targetPercentage = settings?.targetPercentage ?? 85;
    const showStatus = settings?.showStatus ?? true;

    // Determine layout mode based on height
    const isCompact = (h || 0) <= 4;

    // Extract data with fallbacks
    const efficiency = data?.currentEfficiency ?? data?.avg_efficiency ?? 0;
    const target = Number(targetPercentage);

    // Handle empty data gracefully
    if (!data) {
        return (
            <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                No Efficiency Data
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col justify-center items-center h-full w-full p-4">
            {/* Main Efficiency Display */}
            <div className={isCompact ? "text-3xl font-bold text-blue-600" : "text-5xl font-bold text-blue-600"}>
                {efficiency.toFixed(1)}%
            </div>

            {/* Compact vs. Full Layout */}
            {isCompact ? (
                <div className="text-[10px] text-slate-500 mt-1.5 uppercase tracking-wider font-medium">
                    Target {target}%
                </div>
            ) : (
                <div className="w-full mt-4 space-y-2.5 max-w-xs">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Target</span>
                        <span className="text-slate-600 font-semibold">{target.toFixed(1)}%</span>
                    </div>
                    {showStatus && (
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Status</span>
                            <span className={`font-semibold ${efficiency >= target ? "text-blue-600" : "text-amber-600"}`}>
                                {efficiency >= target ? "On Target" : "Below Target"}
                            </span>
                        </div>
                    )}
                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${efficiency >= target ? "bg-blue-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(efficiency, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LineEfficiencyGauge;

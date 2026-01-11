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
            <div className="flex h-full items-center justify-center text-text-muted text-sm">
                No Efficiency Data
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col justify-center items-center h-full w-full p-4">
            {/* Main Efficiency Display */}
            <div className={isCompact ? "text-3xl font-bold text-brand" : "text-5xl font-bold text-brand"}>
                {efficiency.toFixed(1)}%
            </div>

            {/* Compact vs. Full Layout */}
            {isCompact ? (
                <div className="text-[10px] text-text-muted mt-1.5 uppercase tracking-wider font-medium">
                    Target {target}%
                </div>
            ) : (
                <div className="w-full mt-4 space-y-2.5 max-w-xs">
                    <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Target</span>
                        <span className="text-text-main font-semibold">{target.toFixed(1)}%</span>
                    </div>
                    {showStatus && (
                        <div className="flex justify-between text-xs">
                            <span className="text-text-muted">Status</span>
                            <span className={`font-semibold ${efficiency >= target ? "text-brand" : "text-warning"}`}>
                                {efficiency >= target ? "On Target" : "Below Target"}
                            </span>
                        </div>
                    )}
                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-500 bg-brand"
                            style={{ width: `${Math.min(efficiency, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LineEfficiencyGauge;

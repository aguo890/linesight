import React from 'react';
import type { SmartWidgetProps } from '../config';
import { Clock, TrendingUp, Zap } from 'lucide-react';
import { EarnedMinutesDataSchema } from '../registry';
import { z } from 'zod';

// Infer TypeScript type from Zod schema
type EarnedMinutesStats = z.infer<typeof EarnedMinutesDataSchema>;

const EarnedMinutesWidget: React.FC<SmartWidgetProps<EarnedMinutesStats>> = ({
    data
}) => {
    // Format numbers for display
    const formatNumber = (val: number | undefined) => {
        if (val === undefined || val === null || isNaN(val)) return '—';
        if (val >= 1000) {
            return (val / 1000).toFixed(1) + 'k';
        }
        return val.toFixed(0);
    };

    const earnedMins = data?.earned_minutes ?? 0;
    const availableMins = data?.total_available_minutes ?? 0;
    const efficiencyPct = data?.efficiency_pct_aggregate ?? 0;

    // Determine efficiency status color
    let effColor = 'text-blue-600';
    let effBg = 'bg-blue-50';
    if (efficiencyPct < 85) {
        effColor = 'text-amber-600';
        effBg = 'bg-amber-50';
    }
    if (efficiencyPct < 70) {
        effColor = 'text-red-600';
        effBg = 'bg-red-50';
    }

    return (
        <div className="h-full flex flex-col justify-center gap-3 p-2">
            {/* Main KPI: Efficiency */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${effBg}`}>
                <div className="flex items-center gap-2">
                    <TrendingUp className={`w-5 h-5 ${effColor}`} />
                    <span className="text-sm font-medium text-gray-700">Efficiency</span>
                </div>
                <span className={`text-2xl font-bold ${effColor}`}>
                    {efficiencyPct.toFixed(1)}%
                </span>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 gap-3">
                {/* Earned Minutes */}
                <div className="flex flex-col items-center p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs font-medium">Earned</span>
                    </div>
                    <span className="text-lg font-bold text-amber-700">
                        {formatNumber(earnedMins)}
                    </span>
                    <span className="text-[10px] text-gray-500">minutes</span>
                </div>

                {/* Available Minutes */}
                <div className="flex flex-col items-center p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-medium">Available</span>
                    </div>
                    <span className="text-lg font-bold text-slate-700">
                        {formatNumber(availableMins)}
                    </span>
                    <span className="text-[10px] text-gray-500">minutes</span>
                </div>
            </div>
        </div>
    );
};

export default EarnedMinutesWidget;

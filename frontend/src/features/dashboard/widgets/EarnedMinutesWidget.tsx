import React from 'react';
import type { SmartWidgetProps } from '../config';
import { Clock, TrendingUp, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EarnedMinutesDataSchema } from '../registry';
import { z } from 'zod';

// Infer TypeScript type from Zod schema
type EarnedMinutesStats = z.infer<typeof EarnedMinutesDataSchema>;

const EarnedMinutesWidget: React.FC<SmartWidgetProps<EarnedMinutesStats>> = ({
    data
}) => {
    const { t } = useTranslation();
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
    let effColor = 'text-brand';
    let effBg = 'bg-brand/10';
    if (efficiencyPct < 85) {
        effColor = 'text-warning';
        effBg = 'bg-warning/10';
    }
    if (efficiencyPct < 70) {
        effColor = 'text-danger';
        effBg = 'bg-danger/10';
    }

    return (
        <div className="h-full flex flex-col justify-center gap-3 p-2">
            {/* Main KPI: Efficiency */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${effBg}`}>
                <div className="flex items-center gap-2">
                    <TrendingUp className={`w-5 h-5 ${effColor}`} />
                    <span className="text-sm font-medium text-text-main">{t('widgets.common.efficiency')}</span>
                </div>
                <span className={`text-2xl font-bold ${effColor}`}>
                    {efficiencyPct.toFixed(1)}%
                </span>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 gap-3">
                {/* Earned Minutes */}
                <div className="flex flex-col items-center p-3 bg-warning/5 rounded-lg border border-warning/10">
                    <div className="flex items-center gap-1.5 text-warning mb-1">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs font-medium">{t('widgets.earned_minutes.earned')}</span>
                    </div>
                    <span className="text-lg font-bold text-text-main">
                        {formatNumber(earnedMins)}
                    </span>
                    <span className="text-[10px] text-text-muted">{t('widgets.common.minutes')}</span>
                </div>

                {/* Available Minutes */}
                <div className="flex flex-col items-center p-3 bg-surface-subtle rounded-lg border border-border">
                    <div className="flex items-center gap-1.5 text-text-muted mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-medium">{t('widgets.earned_minutes.available')}</span>
                    </div>
                    <span className="text-lg font-bold text-text-main">
                        {formatNumber(availableMins)}
                    </span>
                    <span className="text-[10px] text-text-muted">{t('widgets.common.minutes')}</span>
                </div>
            </div>
        </div>
    );
};

export default EarnedMinutesWidget;

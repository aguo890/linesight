import React, { useMemo } from 'react';
import type { SmartWidgetProps } from '../config';
import { Activity, TrendingUp, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { KpiSummaryDataSchema } from '../registry';
// Schema-inferred types
type KpiData = z.infer<typeof KpiSummaryDataSchema>;

const KpiCard: React.FC<{
    title: string;
    value: string | number;
    trend: number;
    icon: React.ElementType;
    subtext?: string;
}> = ({ title, value, trend, icon: Icon, subtext }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col p-4 bg-surface rounded-lg border border-border shadow-sm h-full justify-between">
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-text-muted">{title}</span>
                <Icon className="h-4 w-4 text-text-muted" />
            </div>
            <div>
                <div className="text-2xl font-bold text-text-main">{value}</div>
                <div className="flex items-center mt-1 text-xs">
                    <span className={trend >= 0 ? "text-success" : "text-danger"}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                    <span className="text-text-muted ml-1">{t('widgets.kpi_summary.vs_last_period')}</span>
                </div>
            </div>
            {subtext && <div className="text-xs text-text-muted mt-1">{subtext}</div>}
        </div>
    );
};

export const KpiSummaryWidget: React.FC<SmartWidgetProps<KpiData>> = ({
    data
}) => {
    const { t } = useTranslation();
    // 1. Data Prep (Safe Access)
    const kpiData = useMemo(() => data || {
        totalOutput: 0,
        efficiency: 0,
        oee: 0,
        trends: { output: 0, efficiency: 0, oee: 0 }
    }, [data]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            <KpiCard
                title={t('widgets.kpi_summary.total_output')}
                value={kpiData.totalOutput.toLocaleString()}
                trend={kpiData.trends.output}
                icon={Activity}
                subtext={t('widgets.kpi_summary.units_produced')}
            />
            <KpiCard
                title={t('widgets.kpi_summary.efficiency')}
                value={`${kpiData.efficiency}%`}
                trend={kpiData.trends.efficiency}
                icon={Zap}
                subtext={t('widgets.kpi_summary.aggregate_average')}
            />
            <KpiCard
                title={t('widgets.kpi_summary.oee')}
                value={`${kpiData.oee}%`}
                trend={kpiData.trends.oee}
                icon={TrendingUp}
                subtext={t('widgets.kpi_summary.oee_full')}
            />
        </div>
    );
};

export default KpiSummaryWidget;

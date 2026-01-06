import React, { useMemo } from 'react';
import type { SmartWidgetProps } from '../config';
import { Activity, TrendingUp, Zap } from 'lucide-react';
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
}> = ({ title, value, trend, icon: Icon, subtext }) => (
    <div className="flex flex-col p-4 bg-card rounded-lg border shadow-sm h-full justify-between">
        <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="flex items-center mt-1 text-xs">
                <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
                <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
        </div>
        {subtext && <div className="text-xs text-muted-foreground mt-1">{subtext}</div>}
    </div>
);

export const KpiSummaryWidget: React.FC<SmartWidgetProps<KpiData>> = ({
    data,
    settings
}) => {
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
                title="Total Output"
                value={kpiData.totalOutput.toLocaleString()}
                trend={kpiData.trends.output}
                icon={Activity}
                subtext="Units produced"
            />
            <KpiCard
                title="Efficiency"
                value={`${kpiData.efficiency}%`}
                trend={kpiData.trends.efficiency}
                icon={Zap}
                subtext="Aggregate average"
            />
            <KpiCard
                title="OEE"
                value={`${kpiData.oee}%`}
                trend={kpiData.trends.oee}
                icon={TrendingUp}
                subtext="Overall Equip. Effectiveness"
            />
        </div>
    );
};

export default KpiSummaryWidget;

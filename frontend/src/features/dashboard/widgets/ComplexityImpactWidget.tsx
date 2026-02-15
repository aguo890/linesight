import React from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { WidgetProps } from '../types';
import { WidgetWrapper, getDensity } from '@/components/WidgetWrapper';
import { TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { useWidgetData } from '@/hooks/useWidgetData';

const ComplexityImpactWidget: React.FC<WidgetProps> = ({
    w = 3, h = 3, productionLineId, demoData, settings, globalFilters
}) => {
    const { t } = useTranslation();
    const density = getDensity(w, h);
    const dataId = 'complexity_impact';
    const { data: fetchedData, isMock, loading: hookLoading, error } = useWidgetData({
        dataId,
        filters: globalFilters,
        settings,
        productionLineId
    });

    const title = settings?.customTitle || t('widgets.complexity_impact.title');
    const highlightOutliers = settings?.highlightOutliers ?? true;

    const loading = !demoData && hookLoading;
    const data = demoData || fetchedData || [];
    console.log("DEBUG [ComplexityWidget] PROPS Data:", JSON.stringify(data, null, 2));
    console.log("DEBUG [ComplexityWidget] isMock:", isMock, "loading:", loading);

    if (loading) {
        return (
            <WidgetWrapper
                title={title}
                icon={<TrendingUp className="w-full h-full text-blue-500" />}
                iconBgColor="bg-blue-50"
                density={density}
            >
                <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin me-2" /> {t('widgets.complexity_impact.loading_styles')}
                </div>
            </WidgetWrapper>
        );
    }

    if (error) {
        return (
            <WidgetWrapper
                title={title}
                icon={<TrendingUp className="w-full h-full text-blue-500" />}
                iconBgColor="bg-blue-50"
                density={density}
            >
                <div className="flex flex-col items-center justify-center h-full text-red-400 space-y-1">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-xs">{error}</span>
                </div>
            </WidgetWrapper>
        );
    }

    return (
        <WidgetWrapper
            title={title}
            icon={<TrendingUp className="w-full h-full text-brand" />}
            iconBgColor="bg-brand/10"
            density={density}
            isMock={isMock || !!demoData}
        >
            <div className="flex-1 min-h-0 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={document.documentElement.dir === 'rtl'
                        ? { top: 10, right: -10, bottom: 0, left: 10 }
                        : { top: 10, right: 10, bottom: 0, left: -10 }
                    }>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            type="number"
                            dataKey="sam"
                            name={t('widgets.complexity_impact.sam')}
                            label={{ value: t('widgets.complexity_impact.sam_complexity'), position: 'insideBottom', offset: -5, fontSize: 10 }}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="efficiency"
                            name={t('widgets.common.efficiency')}
                            unit="%"
                            tick={{ fontSize: 10 }}
                            domain={[0, 'auto']}
                            orientation={document.documentElement.dir === 'rtl' ? 'right' : 'left'}
                        />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(value: any, name: any) => [
                                name === t('widgets.common.efficiency') ? `${(value || 0).toFixed(1)}%` : value,
                                name
                            ]}
                            labelFormatter={(label) => `${t('widgets.complexity_impact.sam')}: ${label}`}
                        />

                        <Scatter name={t('widgets.complexity_impact.styles')} data={data as any[]} fill="#3b82f6">
                            {highlightOutliers && <LabelList dataKey="style_number" position="top" style={{ fontSize: '8px' }} />}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </WidgetWrapper>
    );
};

export default ComplexityImpactWidget;

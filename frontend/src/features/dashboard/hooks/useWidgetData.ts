/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query';
import { type ZodSchema } from 'zod';
import { fetchWidgetData, type ServiceResponse } from '../services/widgetDataService';
import * as mocks from '../services/mockData'; // We still need the mock generators
import { type ShiftType } from '../../../types/analytics';
import { useDashboardSafe } from '../context/DashboardContext';

interface UseWidgetDataOptions<T = any> {
    dataId?: string;
    filters: any;
    settings?: any;
    productionLineId?: string;
    dataSourceId?: string;
    schema?: ZodSchema<T>;
    refreshInterval?: number;
    enabled?: boolean;
}

// Helper to map filters to API params (keep this logic centrally or moved to a utility)
const mapFiltersToParams = (filters: any, dataSourceId?: string): Record<string, any> => {
    const now = new Date();
    const dateFrom = filters.dateRange?.start
        ? filters.dateRange.start.toISOString().split('T')[0]
        : now.toISOString().split('T')[0];
    const dateTo = filters.dateRange?.end
        ? filters.dateRange.end.toISOString().split('T')[0]
        : now.toISOString().split('T')[0];

    let shift: ShiftType | undefined;
    if (filters.shift && ['ALL', 'Morning', 'Evening', 'Night'].includes(filters.shift)) {
        shift = filters.shift as ShiftType;
    } else if (filters.shift === 'MORNING') shift = 'Morning';
    else if (filters.shift === 'EVENING') shift = 'Evening';
    else if (filters.shift === 'NIGHT') shift = 'Night';

    return {
        line_id: dataSourceId, // Orval fetchers still statically expect line_id as the query param key
        date_from: dateFrom,
        date_to: dateTo,
        shift: shift,
    };
};

import {
    getProductionChartApiV1AnalyticsProductionChartGet as fetchProductionChart,
    getOverviewStatsApiV1AnalyticsOverviewGet as fetchOverviewStats,
    getTargetRealizationApiV1AnalyticsTargetRealizationGet as fetchTargetRealization,
    getEarnedMinutesStatsApiV1AnalyticsEarnedMinutesGet as fetchEarnedMinutes,
    getHourlyProductionApiV1AnalyticsProductionHourlyGet as fetchHourlyProduction,
    getSamPerformanceApiV1AnalyticsSamPerformanceGet as fetchSamPerformance,
    getDhuTrendApiV1AnalyticsDhuGet as fetchDhuQuality,
    getSpeedQualityTrendApiV1AnalyticsSpeedQualityGet as fetchSpeedQuality,
    getComplexityAnalysisApiV1AnalyticsComplexityGet as fetchComplexity,
    getDowntimeReasonsApiV1AnalyticsDowntimeReasonsGet as fetchDowntime,
    getStyleProgressApiV1AnalyticsProductionStylesGet as fetchStyleProgress,
    getWorkforceStatsApiV1AnalyticsWorkforceGet as fetchWorkforce
} from '@/api/endpoints/analytics/analytics';

// Map dataId to fetcher
const FETCHER_MAP: Record<string, (params: any) => Promise<any>> = {
    // Efficiency & Production
    'production_history': fetchProductionChart,
    'efficiency_trend': fetchOverviewStats,
    'efficiency_kpi': fetchOverviewStats, // Uses same endpoint as trend
    'realization_kpi': fetchTargetRealization,
    'earned_minutes': fetchEarnedMinutes,
    'production_timeline': fetchHourlyProduction,
    'sam_performance': fetchSamPerformance,
    'kpi_summary': fetchOverviewStats, // Aggregated KPIs

    // Quality
    'dhu_history': fetchDhuQuality,
    'speed_quality_scatter': fetchSpeedQuality,
    'complexity_impact': fetchComplexity,

    // Operations
    'downtime_reasons': fetchDowntime,
    'style_progress': fetchStyleProgress,

    // Workforce
    'workforce_stats': fetchWorkforce,
};

const getFetcherForDataId = (dataId: string): ((params: any) => Promise<any>) | undefined => {
    return FETCHER_MAP[dataId];
};

// Map dataId to mock generator
const getMockGeneratorForDataId = (dataId: string): ((filters: any) => any) => {
    // This connects the string ID to the imported mock functions
    // We can use the existing DATA_ADAPTERS logic or a simple switch here to break the dependency on the old file if we want
    // For safety and speed, let's map the ones we know
    const mapping: Record<string, (f: any) => any> = {
        'production_history': mocks.getProductionData,
        'efficiency_trend': mocks.getEfficiencyData,
        'efficiency_kpi': mocks.getEfficiencyKpiData,
        'realization_kpi': mocks.getRealizationData,
        'dhu_quality': mocks.getQualityCategoryData,
        'dhu_history': mocks.getDhuHistoryData,
        'complexity_impact': mocks.getComplexityData,
        'speed_quality_scatter': mocks.getSpeedQualityData,
        'downtime_reasons': mocks.getDowntimeData,
        'workforce_stats': mocks.getWorkforceData,
        'production_timeline': mocks.getTimelineData,
        'style_progress': mocks.getStyleData,
        'sam_performance': mocks.getSamPerformanceData,
        'earned_minutes': mocks.getEarnedMinutesData,
        'kpi_summary': mocks.getKpiSummaryData,
        'target-realization': mocks.getRealizationData // Alias for legacy/mismatched ID
    };
    return mapping[dataId] || ((_f) => null);
};

export function useWidgetData<T = any>({
    dataId,
    filters,
    settings,
    dataSourceId,
    schema,
    refreshInterval = 30000,
    enabled = true
}: UseWidgetDataOptions<T>) {

    // Get refresh timestamp from context for cache-busting on manual refresh
    // Uses "safe" version to work outside DashboardProvider (previews, tests)
    const dashboardContext = useDashboardSafe();
    const lastRefreshAt = dashboardContext?.lastRefreshAt ?? 0;

    // resolve dependencies - use dataSourceId for filtering (line_id param)
    const params = mapFiltersToParams(filters, dataSourceId);
    const fetcher = dataId ? getFetcherForDataId(dataId) : undefined;
    const mockGenerator = dataId ? getMockGeneratorForDataId(dataId) : () => null;

    // Debug: Log data source being fetched
    console.log(`[DEBUG] Fetching Widget Data for Source: ${dataSourceId}`);

    const queryInfo = useQuery<ServiceResponse<T>, Error>({
        // Include lastRefreshAt to force hard refresh when user clicks the refresh button
        queryKey: ['widget-data', dataId, filters, settings, dataSourceId, lastRefreshAt],
        queryFn: () => {
            if (!dataId) throw new Error("No Data ID provided");
            console.log(`[DEBUG][${dataId}] 🎣 Query Function Triggered`, { filters });
            return fetchWidgetData(
                dataId,
                fetcher,
                params,
                schema,
                mockGenerator,
                filters // mocks take raw filters often
            );
        },
        enabled: enabled && !!dataId,
        refetchInterval: refreshInterval,
        retry: 1,
        staleTime: 1000 * 60, // 1 minute
    });

    return {
        // Un-wrap the envelope for the UI
        data: queryInfo.data?.data,

        // Metadata
        isMock: queryInfo.data?.source === 'MOCK',

        // Standard States
        loading: queryInfo.isLoading,
        error: queryInfo.isError ? (queryInfo.error instanceof Error ? queryInfo.error.message : 'Unknown Error') : null,
        refetch: queryInfo.refetch
    };
}

export default useWidgetData;


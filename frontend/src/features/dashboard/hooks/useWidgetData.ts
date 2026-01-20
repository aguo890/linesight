import { useQuery } from '@tanstack/react-query';
import { type ZodSchema } from 'zod';
import { fetchWidgetData, type ServiceResponse } from '../services/widgetDataService';
import * as mocks from '../services/mockData'; // We still need the mock generators
import { type FilterParams, type ShiftType, ANALYTICS_ENDPOINTS } from '../services/analyticsApi';
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
const mapFiltersToParams = (filters: any, dataSourceId?: string): FilterParams => {
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
        line_id: dataSourceId,
        date_from: dateFrom,
        date_to: dateTo,
        shift: shift,
    };
};

// Map dataId to endpoint path using centralized constants
const ENDPOINT_MAP: Record<string, string> = {
    // Efficiency & Production
    'production_history': ANALYTICS_ENDPOINTS.productionChart,
    'efficiency_trend': ANALYTICS_ENDPOINTS.overview,
    'efficiency_kpi': ANALYTICS_ENDPOINTS.overview, // Uses same endpoint as trend
    'realization_kpi': ANALYTICS_ENDPOINTS.targetRealization,
    'earned_minutes': ANALYTICS_ENDPOINTS.earnedMinutes,
    'production_timeline': ANALYTICS_ENDPOINTS.hourlyProduction,
    'sam_performance': ANALYTICS_ENDPOINTS.samPerformance,
    'kpi_summary': ANALYTICS_ENDPOINTS.overview, // Aggregated KPIs

    // Quality
    'dhu_history': ANALYTICS_ENDPOINTS.dhuQuality,
    'speed_quality_scatter': ANALYTICS_ENDPOINTS.speedQuality,
    'complexity_impact': ANALYTICS_ENDPOINTS.complexity,

    // Operations
    'downtime_reasons': ANALYTICS_ENDPOINTS.downtime,
    'style_progress': ANALYTICS_ENDPOINTS.styleProgress,

    // Workforce
    'workforce_stats': ANALYTICS_ENDPOINTS.workforce,

    // Note: 'upload_history' uses /ingestion/uploads, not analytics
};

const getEndpointForDataId = (dataId: string): string | undefined => {
    return ENDPOINT_MAP[dataId];
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
    const endpoint = dataId ? getEndpointForDataId(dataId) : undefined;
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
                endpoint,
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


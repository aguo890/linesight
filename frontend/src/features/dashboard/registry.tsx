
import React, { lazy } from 'react';
import { z } from 'zod';
import type { WidgetProps } from './config';
import { decimalField, optionalDecimalField } from '@/lib/schemaHelpers';

// Lazy load widget components
const ProductionChart = lazy(() => import('./widgets/ProductionChart')) as any;
const DhuQualityChart = lazy(() =>
    import('./widgets/DhuQualityChart').then(module => ({ default: module.DhuQualityChart }))
);
const LineEfficiencyGauge = lazy(() => import('./widgets/LineEfficiencyGauge'));
const ProductionTimeline = lazy(() => import('./widgets/ProductionTimeline'));
const SamPerformanceMetric = lazy(() => import('./widgets/SamPerformanceMetric'));
const WorkforceAttendance = lazy(() => import('./widgets/WorkforceAttendance'));
// UploadHistoryWidget removed - use UploadHistory component in factory-floor instead
const StyleProgressWidget = lazy(() => import('./widgets/StyleProgressWidget'));
const ComplexityImpactWidget = lazy(() => import('./widgets/ComplexityImpactWidget'));
const SpeedQualityWidget = lazy(() => import('./widgets/SpeedQualityWidget'));
const TargetRealizationWidget = lazy(() => import('./widgets/TargetRealizationWidget'));
const EarnedMinutesWidget = lazy(() => import('./widgets/EarnedMinutesWidget'));
const BlockerCloudWidget = lazy(() => import('./widgets/BlockerCloudWidget'));
const KpiSummaryWidget = lazy(() => import('./widgets/KpiSummaryWidget')) as any;


// --- 1. Manifest & Contracts ---

export type WidgetCategory = 'Efficiency' | 'Quality' | 'Workforce' | 'Operations';

export interface WidgetManifest<T = any> {
    id: string; // Unique strictly typed string
    meta: {
        title: string;
        description: string;
        category: WidgetCategory;
        tags: string[];
        priority?: number; // Visualization priority often used in "Add Widget" lists
        icon: string;      // Lucide icon name from iconMap
        iconColor?: string; // Tailwind class
        bgColor?: string;   // Tailwind class
    };
    layout: {
        w: number;
        h: number;
        minW: number;
        minH: number;
    };
    // The lazy component itself - can be V1 (WidgetProps) or V2 (SmartWidgetProps<any, any>)
    component: React.LazyExoticComponent<React.ComponentType<any>> | React.ComponentType<any>;
    // Zod schema for settings
    settingsSchema: z.ZodSchema<T>;
    // NEW: Zod Schema for Data (API Response)
    // This allows us to validate mock data AND real API data
    dataSchema?: z.ZodSchema<any>;
    // Default initial settings
    initialSettings: T;
    // Optional: Data ID for registry-driven fetching
    dataId?: string;
    // Requirements for compatibility checking
    requirements?: {
        rawColumns?: string[];
        computedMetrics?: string[];
    };
    // Define which global filters this specific widget honors
    filterSubscription?: {
        dateRange?: boolean;
        shift?: boolean;
        productionLine?: boolean;
    };
    // Schema Versioning (Required)
    version: number;
    // Migrations: map target version (number) -> transform function
    migrations?: Record<number, (settings: any) => any>;
    // Feature Flag: Lock widget as "Coming Soon"
    locked?: boolean;
}


// --- 2. Schemas ---

const CommonSettingsSchema = z.object({
    customTitle: z.string().optional().describe("Widget Title"),
    // Global refresh rate for all widgets (0 = disabled)
    refreshRate: z.number().min(0).default(0).describe("Auto-Refresh (sec)"),
    version: z.number().optional(),
});

const ProductionChartSchema = CommonSettingsSchema.extend({
    showLegend: z.boolean().default(true).describe("Show Legend"),
    yAxisMax: z.number().default(0).describe("Y-Axis Max (0=Auto)"),
});

// V2 Data Schema for Production Chart
// Matches API response: { data_points: [...], line_filter: "..." }
export const ProductionChartDataSchema = z.object({
    data_points: z.array(z.object({
        day: z.string(),
        actual: z.number(),
        target: z.number()
    })),
    line_filter: z.string().nullable().optional()
});


const DhuQualitySchema = CommonSettingsSchema.extend({
    maxAcceptableDHU: z.number().default(2.5).describe("Max Acceptable DHU (%)"),
    showThresholdLine: z.boolean().default(true).describe("Show Threshold Line"),
});

const LineEfficiencySchema = CommonSettingsSchema.extend({
    targetPercentage: z.number().default(85).describe("Efficiency Target (%)"),
    showStatus: z.boolean().default(true).describe("Show Status Text"),
});

const ProductionTimelineSchema = CommonSettingsSchema.extend({
    showHourlyTarget: z.boolean().default(true).describe("Show Hourly Target"),
    hourlyTarget: z.number().default(100).describe("Hourly Target"),
});

const SamPerformanceSchema = CommonSettingsSchema.extend({
    showTrend: z.boolean().default(true).describe("Show Trend Arrow"),
});

const WorkforceSchema = CommonSettingsSchema.extend({
    showBreakdown: z.boolean().default(true).describe("Show Breakdown"),
    expectedOperators: z.number().default(0).describe("Expected Operators"),
    expectedHelpers: z.number().default(0).describe("Expected Helpers"),
});

// UploadHistorySchema removed

const StyleProgressSchema = CommonSettingsSchema.extend({
    showPercentage: z.boolean().default(true).describe("Show Completion %"),
    sortBy: z.enum(['progress', 'name', 'quantity']).default('progress').describe("Sort By"),
});

const ComplexityImpactSchema = CommonSettingsSchema.extend({
    showTrendLine: z.boolean().default(true).describe("Show Trend Line"),
    highlightOutliers: z.boolean().default(true).describe("Highlight Outliers"),
});

const SpeedQualitySchema = CommonSettingsSchema.extend({
    showQuadrantLabels: z.boolean().default(true).describe("Show Quadrant Labels"),
    efficiencyThreshold: z.number().default(85).describe("Efficiency Threshold (%)"),
    dhuThreshold: z.number().default(2.5).describe("DHU Threshold (%)"),
});

const TargetRealizationSchema = CommonSettingsSchema.extend({
    showVariance: z.boolean().default(true).describe("Show Variance Badge"),
});

const EarnedMinutesSchema = CommonSettingsSchema.extend({
    showEfficiency: z.boolean().default(true).describe("Show Efficiency %"),
    targetEfficiency: z.number().default(85).describe("Target Efficiency (%)"),
});

const BlockerCloudSchema = CommonSettingsSchema.extend({
    maxItems: z.number().default(10).describe("Max Items Shown"),
    showCounts: z.boolean().default(true).describe("Show Occurrence Counts"),
});

const KpiSummarySchema = CommonSettingsSchema.extend({
    showTrends: z.boolean().default(true).describe("Show Trend Indicators"),
});

// V2 Data Schema for KPI Summary
export const KpiSummaryDataSchema = z.object({
    totalOutput: z.number(),
    efficiency: z.number(),
    oee: z.number(),
    trends: z.object({
        output: z.number(),
        efficiency: z.number(),
        oee: z.number(),
    })
});

// V2 Data Schema for DHU Quality
// Matches API response: Array of DhuPoint objects from /analytics/quality/dhu
export const DhuQualityDataSchema = z.array(z.object({
    date: z.string(),
    dhu: decimalField
}));

// V2 Data Schema for Line Efficiency
// Note: Backend /analytics/overview returns OverviewStats, we need to extract relevant fields
export const LineEfficiencyDataSchema = z.object({
    currentEfficiency: z.number().optional(),
    targetEfficiency: z.number().optional(),
    trend: z.number().optional(),
    status: z.enum(['on-track', 'at-risk', 'behind']).optional(),
    // Also accept OverviewStats shape from backend
    avg_efficiency: optionalDecimalField,
    efficiency_change_pct: optionalDecimalField,
}).passthrough();

// V2 Data Schema for Earned Minutes
// API returns Decimal as strings, so we transform them to numbers
export const EarnedMinutesDataSchema = z.object({
    earned_minutes: decimalField,
    total_available_minutes: decimalField,
    efficiency_pct_aggregate: decimalField,
});

// V2 Data Schema for Target Realization
export const TargetRealizationDataSchema = z.object({
    actual: z.number(),
    target: z.number(),
    // Backend returns Decimal, handle string/number union
    percentage: decimalField,
    variance: z.number(),
});

// V2 Data Schema for Speed vs Quality
// Backend returns SpeedQualityResponse with data_points array
export const SpeedQualityDataSchema = z.object({
    data_points: z.array(z.object({
        date: z.string(),
        efficiency_pct: decimalField,
        defects_per_hundred: decimalField,
    }))
});

// V2 Data Schema for Style Progress
// Backend returns StyleProgressResponse with active_styles array
export const StyleProgressDataSchema = z.object({
    active_styles: z.array(z.object({
        style_code: z.string(),
        target: z.number(),
        actual: z.number(),
        progress_pct: decimalField,
        status: z.string(),
    }))
});

// V2 Data Schema for Complexity Impact
// Backend returns ComplexityAnalysisResponse with data_points array
export const ComplexityDataSchema = z.object({
    data_points: z.array(z.object({
        style_id: z.string(),
        sam: decimalField,
        efficiency_pct: decimalField,
        style_code: z.string(),
    }))
});

// V2 Data Schema for Downtime/Blockers
// Backend returns DowntimeAnalysisResponse with reasons array
export const DowntimeDataSchema = z.object({
    reasons: z.array(z.object({
        reason: z.string(),
        count: z.number(),
    }))
});

// V2 Data Schema for Workforce Stats
// Matches backend WorkforceStats Pydantic model
export const WorkforceDataSchema = z.object({
    present: z.number(),
    target: z.number(),
    absent: z.number(),
    late: z.number(),
});

// V2 Data Schema for Production Timeline / Hourly Production
// Backend returns simple array of integers (list[int])
// Mock data returns array of objects with time/actual/target
export const TimelineDataSchema = z.union([
    // Backend format: simple int array representing hourly quantities
    z.array(z.number()),
    // Mock/legacy format with full objects
    z.array(z.object({
        hour: z.string().optional(),
        time: z.string().optional(),
        actual: z.number(),
        target: z.number().optional(),
    }))
]);

// V2 Data Schema for SAM Performance
export const SamPerformanceDataSchema = z.object({
    efficiency: decimalField,
    efficiency_change: decimalField,
    avg_sam_per_hour: decimalField,
    total_sam: decimalField,
    breakdown: z.array(z.object({
        name: z.string(),
        actual: z.number(),
        standard: z.number(),
        efficiency: z.number(),
    })).optional(),
});


// --- 3. The Single Source of Truth List ---

export const ALL_WIDGETS: WidgetManifest[] = [
    // --- EFFICIENCY WIDGETS ---
    {
        id: 'production-chart',
        meta: {
            title: 'widgets.titles.production_chart',
            description: 'widgets.descriptions.production_chart',
            category: 'Efficiency',
            tags: ['essential', 'real-time'],
            priority: 100,
            icon: 'BarChart3',
            iconColor: 'text-brand',
            bgColor: 'bg-brand/10'
        },
        layout: { w: 6, h: 10, minW: 4, minH: 6 },
        component: ProductionChart,
        settingsSchema: ProductionChartSchema,
        initialSettings: ProductionChartSchema.parse({}),
        dataId: 'production_hourly',
        dataSchema: ProductionChartDataSchema,
        requirements: { rawColumns: ['actual_qty', 'planned_qty'] },
        filterSubscription: { dateRange: true, productionLine: true },
        version: 1,
        migrations: {
            1: (settings) => {
                // Example migration: v0 had 'title', v1 has 'customTitle'
                // if (settings.title) { settings.customTitle = settings.title; delete settings.title; }
                return settings;
            }
        },
    },
    {
        id: 'line-efficiency',
        meta: {
            title: 'widgets.titles.line_efficiency',
            description: 'widgets.descriptions.line_efficiency',
            category: 'Efficiency',
            tags: ['essential', 'kpi'],
            priority: 95,
            icon: 'Gauge',
            iconColor: 'text-brand',
            bgColor: 'bg-brand/10'
        },
        layout: { w: 3, h: 6, minW: 2, minH: 4 },
        component: LineEfficiencyGauge,
        settingsSchema: LineEfficiencySchema,
        initialSettings: LineEfficiencySchema.parse({}),
        dataId: 'efficiency_kpi',
        dataSchema: LineEfficiencyDataSchema, // Now V2
        requirements: { rawColumns: ['actual_qty', 'sam', 'worked_minutes', 'operators_present', 'helpers_present'] },
        filterSubscription: { dateRange: true, shift: true, productionLine: true },
        version: 2
    },
    {
        id: 'target-realization',
        meta: {
            title: 'widgets.titles.daily_target',
            description: 'widgets.descriptions.daily_target',
            category: 'Efficiency',
            tags: ['essential', 'real-time'],
            priority: 85,
            icon: 'TrendingUp',
            iconColor: 'text-brand-secondary',
            bgColor: 'bg-brand-secondary/10'
        },
        layout: { w: 6, h: 6, minW: 4, minH: 4 },
        component: TargetRealizationWidget,
        settingsSchema: TargetRealizationSchema,
        initialSettings: TargetRealizationSchema.parse({}),
        dataId: 'realization_kpi',
        dataSchema: TargetRealizationDataSchema,
        requirements: { rawColumns: ['actual_qty', 'planned_qty'] },
        filterSubscription: { dateRange: true, shift: true },
        version: 1,
        locked: true,
    },
    {
        id: 'earned-minutes',
        meta: {
            title: 'widgets.titles.earned_minutes',
            description: 'widgets.descriptions.earned_minutes',
            category: 'Efficiency',
            tags: ['kpi'],
            priority: 75,
            icon: 'Zap',
            iconColor: 'text-warning',
            bgColor: 'bg-warning/10'
        },
        layout: { w: 3, h: 6, minW: 2, minH: 6 },
        component: EarnedMinutesWidget,
        settingsSchema: EarnedMinutesSchema,
        initialSettings: EarnedMinutesSchema.parse({}),
        dataId: 'earned_minutes',
        dataSchema: EarnedMinutesDataSchema,
        requirements: { computedMetrics: ['earned_minutes'], rawColumns: ['worked_minutes'] },
        filterSubscription: { dateRange: true, shift: true, productionLine: true },
        version: 1,
    },
    {
        id: 'production-timeline',
        meta: {
            title: 'widgets.titles.production_timeline',
            description: 'widgets.descriptions.production_timeline',
            category: 'Efficiency',
            tags: ['tracking'],
            priority: 50,
            icon: 'Clock',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            bgColor: 'bg-indigo-50 dark:bg-indigo-500/10'
        },
        layout: { w: 6, h: 6, minW: 4, minH: 4 },
        component: ProductionTimeline,
        settingsSchema: ProductionTimelineSchema,
        initialSettings: ProductionTimelineSchema.parse({}),
        dataId: 'production_timeline',
        dataSchema: TimelineDataSchema,
        requirements: { rawColumns: ['actual_qty'] },
        version: 1,
        locked: true,
    },
    {
        id: 'sam-performance',
        meta: {
            title: 'widgets.titles.sam_performance',
            description: 'widgets.descriptions.sam_performance',
            category: 'Efficiency',
            tags: ['kpi'],
            priority: 45,
            icon: 'Activity',
            iconColor: 'text-brand-secondary',
            bgColor: 'bg-brand-secondary/10'
        },
        layout: { w: 3, h: 6, minW: 2, minH: 4 },
        component: SamPerformanceMetric,
        settingsSchema: SamPerformanceSchema,
        initialSettings: SamPerformanceSchema.parse({}),
        dataId: 'sam_performance',
        dataSchema: SamPerformanceDataSchema,
        requirements: { rawColumns: ['sam'] },
        filterSubscription: { dateRange: true },
        version: 1,
    },

    // --- QUALITY WIDGETS ---
    {
        id: 'dhu-quality',
        meta: {
            title: 'widgets.titles.dhu_quality',
            description: 'widgets.descriptions.dhu_quality',
            category: 'Quality',
            tags: ['essential', 'kpi'],
            priority: 90,
            icon: 'ShieldCheck',
            iconColor: 'text-danger',
            bgColor: 'bg-danger/10'
        },
        layout: { w: 6, h: 10, minW: 4, minH: 6 },
        component: DhuQualityChart,
        settingsSchema: DhuQualitySchema,
        initialSettings: DhuQualitySchema.parse({}),
        dataId: 'dhu_history',
        dataSchema: DhuQualityDataSchema, // Now V2
        requirements: { computedMetrics: ['dhu'] },
        filterSubscription: { dateRange: true, shift: true, productionLine: true },
        version: 2,
    },
    {
        id: 'speed-quality',
        meta: {
            title: 'widgets.titles.speed_quality',
            description: 'widgets.descriptions.speed_quality',
            category: 'Quality',
            tags: ['advanced', 'kpi'],
            priority: 80,
            icon: 'Scale',
            iconColor: 'text-danger',
            bgColor: 'bg-brand/10'
        },
        layout: { w: 6, h: 10, minW: 4, minH: 6 },
        component: SpeedQualityWidget,
        settingsSchema: SpeedQualitySchema,
        initialSettings: SpeedQualitySchema.parse({}),
        dataId: 'speed_quality_scatter',
        dataSchema: SpeedQualityDataSchema,
        requirements: { computedMetrics: ['line_efficiency', 'dhu'] },
        filterSubscription: { dateRange: true, shift: true },
        version: 1,
    },
    {
        id: 'complexity-impact',
        meta: {
            title: 'widgets.titles.complexity_impact',
            description: 'widgets.descriptions.complexity_impact',
            category: 'Quality',
            tags: ['advanced'],
            priority: 55,
            icon: 'Box',
            iconColor: 'text-warning',
            bgColor: 'bg-warning/10'
        },
        layout: { w: 6, h: 10, minW: 4, minH: 6 },
        component: ComplexityImpactWidget,
        settingsSchema: ComplexityImpactSchema,
        initialSettings: ComplexityImpactSchema.parse({}),
        dataId: 'complexity_impact',
        dataSchema: ComplexityDataSchema,
        requirements: { rawColumns: ['sam', 'styleNumber'], computedMetrics: ['line_efficiency'] },
        version: 1,
    },

    // --- OPERATIONS WIDGETS ---
    {
        id: 'blocker-cloud',
        meta: {
            title: 'widgets.titles.top_blockers',
            description: 'widgets.descriptions.top_blockers',
            category: 'Operations',
            tags: ['insight'],
            priority: 70,
            icon: 'AlertOctagon',
            iconColor: 'text-danger',
            bgColor: 'bg-danger/10'
        },
        layout: { w: 6, h: 6, minW: 4, minH: 4 },
        component: BlockerCloudWidget,
        settingsSchema: BlockerCloudSchema,
        initialSettings: BlockerCloudSchema.parse({}),
        dataId: 'downtime_reasons',
        dataSchema: DowntimeDataSchema,
        requirements: { rawColumns: ['downtime_reason'] },
        filterSubscription: { dateRange: true, shift: true },
        version: 1,
    },
    {
        id: 'style-progress',
        meta: {
            title: 'widgets.titles.style_progress',
            description: 'widgets.descriptions.style_progress',
            category: 'Operations',
            tags: ['tracking'],
            priority: 60,
            icon: 'PieChart',
            iconColor: 'text-brand-secondary',
            bgColor: 'bg-brand-secondary/10'
        },
        layout: { w: 6, h: 10, minW: 6, minH: 6 },
        component: StyleProgressWidget,
        settingsSchema: StyleProgressSchema,
        initialSettings: StyleProgressSchema.parse({}),
        dataId: 'style_progress',
        dataSchema: StyleProgressDataSchema,
        requirements: { rawColumns: ['style_number', 'actual_qty', 'planned_qty'] },
        filterSubscription: { dateRange: true },
        version: 1,
    },
    // upload-history widget removed - use UploadHistory component in DataIntegrationPanel instead

    // --- WORKFORCE WIDGETS ---
    {
        id: 'workforce-attendance',
        meta: {
            title: 'widgets.titles.workforce_attendance',
            description: 'widgets.descriptions.workforce_attendance',
            category: 'Workforce',
            tags: ['essential'],
            priority: 65,
            icon: 'Users',
            iconColor: 'text-teal-600 dark:text-teal-400',
            bgColor: 'bg-teal-50 dark:bg-teal-500/10'
        },
        layout: { w: 3, h: 6, minW: 2, minH: 4 },
        component: WorkforceAttendance,
        settingsSchema: WorkforceSchema,
        initialSettings: WorkforceSchema.parse({}),
        dataId: 'workforce_stats',
        dataSchema: WorkforceDataSchema,
        requirements: { rawColumns: ['operators_present', 'helpers_present'] },
        version: 1,
        locked: true,
    },
    {
        id: 'kpi-summary',
        meta: {
            title: 'widgets.titles.kpi_summary',
            description: 'widgets.descriptions.kpi_summary',
            category: 'Efficiency',
            tags: ['kpi', 'essential'],
            priority: 110,
            icon: 'CheckCircle2',
            iconColor: 'text-text-muted',
            bgColor: 'bg-surface-subtle'
        },
        layout: { w: 12, h: 4, minW: 6, minH: 3 },
        component: KpiSummaryWidget,
        settingsSchema: KpiSummarySchema,
        initialSettings: KpiSummarySchema.parse({}),
        dataId: 'kpi_summary',
        dataSchema: KpiSummaryDataSchema, // Now marked as V2
        requirements: { computedMetrics: ['line_efficiency', 'actual_qty'] },
        filterSubscription: { dateRange: true, shift: true, productionLine: true },
        version: 1,
        locked: true,
    }
];


// --- 4. Derived Helpers for O(1) Lookups & Backward Compatibility ---

// Map ID -> Component (The Registry) (Includes Aliases for Legacy)
export const WIDGET_REGISTRY: Record<string, React.ComponentType<WidgetProps>> = ALL_WIDGETS.reduce((acc, w) => {
    acc[w.id] = w.component as React.ComponentType<WidgetProps>;
    return acc;
}, {} as Record<string, React.ComponentType<WidgetProps>>);

// Add Legacy Aliases (Manually for now to keep them working)
// 'style', 'complexity', 'speed', 'target', 'earned', 'blocker'
const LEGACY_ALIASES: Record<string, string> = {
    'style': 'style-progress',
    'complexity': 'complexity-impact',
    'speed': 'speed-quality',
    'target': 'target-realization',
    'earned': 'earned-minutes',
    'blocker': 'blocker-cloud'
};

Object.entries(LEGACY_ALIASES).forEach(([alias, targetId]) => {
    const target = ALL_WIDGETS.find(w => w.id === targetId);
    if (target) {
        WIDGET_REGISTRY[alias] = target.component as React.ComponentType<WidgetProps>;
    }
});

// Add stats dummy widget
WIDGET_REGISTRY['stats'] = ({ w, h }: any) => <div className="p-4 text-center text-gray-500">Stats Widget ({w}x{h})</div>;


// Map ID -> Definitions (For UI & Metadata)
// We transform Manifest back to the old "WidgetDefinition" shape if needed anywhere, 
// or simply assume consumers will stick to the new shape.
// Ideally, we start creating new helpers.

export const getWidgetManifest = (id: string): WidgetManifest | undefined => {
    return ALL_WIDGETS.find(w => w.id === id);
};

export const getWidgetManifestByDataId = (dataId: string): WidgetManifest | undefined => {
    return ALL_WIDGETS.find(w => w.dataId === dataId);
};

export const getWidgetManifestById = (id: string): WidgetManifest | undefined => {
    return ALL_WIDGETS.find(w => w.id === id);
};

export const getWidgetSchema = (id: string): z.ZodSchema<any> => {
    const manifest = getWidgetManifest(id);
    return manifest ? manifest.settingsSchema : z.any();
};

export const getWidgetComponent = (widgetId: string) => {
    return WIDGET_REGISTRY[widgetId] || (() => <div className="p-4 text-red-500">Unknown Widget {widgetId}</div>);
};

export const isValidWidgetType = (widgetType: string): boolean => {
    return widgetType in WIDGET_REGISTRY;
};

// Re-export resolveWidgetType from WidgetService
export { resolveWidgetType } from './services/WidgetService';


// --- 5. Layout & Compatibility Helpers ---

export const getWidgetLayout = (widgetType: string, x: number, y: number) => {
    const manifest = getWidgetManifest(widgetType);
    // Resolve alias if not found directly
    const targetId = manifest ? widgetType : LEGACY_ALIASES[widgetType];
    const resolvedManifest = targetId ? getWidgetManifest(targetId) : undefined;

    const def = resolvedManifest?.layout;
    const defaultDimensions = { w: 6, h: 6, minW: 4, minH: 4 };

    return {
        i: `${widgetType}-${crypto.randomUUID().slice(0, 8)}`,
        widget: widgetType,
        x,
        y,
        w: def?.w ?? defaultDimensions.w,
        h: def?.h ?? defaultDimensions.h,
        minW: def?.minW ?? defaultDimensions.minW,
        minH: def?.minH ?? defaultDimensions.minH,
    };
};

// Helper for "Add Widget" UI (mimics old WIDGET_DEFINITIONS)
export const WIDGET_DEFINITIONS = ALL_WIDGETS.map(w => ({
    id: w.id,
    ...w.meta,
    defaultW: w.layout.w,
    defaultH: w.layout.h,
    minW: w.layout.minW,
    minH: w.layout.minH,
    requiredRawColumns: w.requirements?.rawColumns,
    requiredComputedMetrics: w.requirements?.computedMetrics,
    settingsSchema: w.settingsSchema, // Now a Zod Schema
    dataId: w.dataId,
    locked: w.locked
}));


// --- 6. Computed Metrics Logic (Unchanged) ---
export const COMPUTED_METRICS: Record<string, string[][]> = {
    'line_efficiency': [
        ['actual_qty', 'sam', 'worked_minutes', 'operators_present', 'helpers_present']
    ],
    'earned_minutes': [
        ['earned_minutes'],
        ['actual_qty', 'sam']
    ],
    'dhu': [
        ['dhu'],
        ['defect_count', 'actual_qty'],
        ['defects', 'actual_qty']
    ]
};

// --- 7. Compatibility Calculator ---
export interface CompatibilityStatus {
    status: 'supported' | 'near-miss' | 'locked';
    score: number;
    missingFields: string[];
}

export const getCompatibilityStatus = (
    widgetId: string,
    activeFields: string[]
): CompatibilityStatus => {
    const manifest = getWidgetManifest(widgetId);
    if (!manifest) return { status: 'locked', score: 0, missingFields: [] };

    const requirements = manifest.requirements || {};

    const isMetricAvailable = (metric: string): boolean => {
        const options = COMPUTED_METRICS[metric];
        if (!options) return activeFields.includes(metric);
        return options.some(path => path.every(col => activeFields.includes(col)));
    };

    const missingRaw = (requirements.rawColumns || [])
        .filter(col => !activeFields.includes(col));

    const missingComputed = (requirements.computedMetrics || [])
        .filter(m => !isMetricAvailable(m));

    const missingAll = [...missingRaw, ...missingComputed];
    const totalRequired = (requirements.rawColumns?.length || 0) +
        (requirements.computedMetrics?.length || 0);

    const score = totalRequired === 0 ? 1 : (totalRequired - missingAll.length) / totalRequired;

    let status: CompatibilityStatus['status'] = 'locked';
    if (manifest.locked) status = 'locked';
    else if (score === 1) status = 'supported';
    else if (missingAll.length === 1) status = 'near-miss';

    return { status, score, missingFields: missingAll };
};

// --- 8. Bundles (Unchanged) ---
export type BundleCategory = 'Recommended' | 'Operations' | 'Strategy';

export interface WidgetBundle {
    id: string;
    title: string;
    description: string;
    icon: string;
    widgetIds: string[];
    displayCategory: BundleCategory;
}

export const WIDGET_BUNDLES: WidgetBundle[] = [
    {
        id: 'efficiency-starter',
        title: 'Efficiency Kickstart',
        description: 'Essential toolkit for tracking output and hourly performance.',
        icon: 'Zap',
        widgetIds: ['production-chart', 'line-efficiency', 'target-realization', 'production-timeline'],
        displayCategory: 'Recommended'
    },
    {
        id: 'quality-auditor',
        title: 'Quality Auditor',
        description: 'Focus on DHU, defects, and speed-quality trade-offs.',
        icon: 'ShieldCheck',
        widgetIds: ['dhu-quality', 'speed-quality', 'blocker-cloud'],
        displayCategory: 'Operations'
    },
    {
        id: 'floor-manager',
        title: 'Floor Manager View',
        description: 'Real-time workforce and production visibility.',
        icon: 'Users',
        widgetIds: ['production-chart', 'workforce-attendance', 'earned-minutes', 'style-progress'],
        displayCategory: 'Recommended'
    },
    {
        id: 'executive-summary',
        title: 'Executive Summary',
        description: 'High-level KPIs for strategic decision-making.',
        icon: 'TrendingUp',
        widgetIds: ['line-efficiency', 'dhu-quality', 'target-realization'],
        displayCategory: 'Strategy'
    }
];

export interface BundleReadiness {
    isReady: boolean;
    percentage: number;
    supportedCount: number;
    totalCount: number;
    supportedWidgetIds: string[];
}

export const getBundleReadiness = (bundleId: string, activeFields: string[]): BundleReadiness => {
    const bundle = WIDGET_BUNDLES.find(b => b.id === bundleId);
    if (!bundle) return { isReady: false, percentage: 0, supportedCount: 0, totalCount: 0, supportedWidgetIds: [] };

    const supportedWidgetIds = bundle.widgetIds.filter(id => {
        const { status } = getCompatibilityStatus(id, activeFields);
        return status === 'supported';
    });

    const supportedCount = supportedWidgetIds.length;
    const totalCount = bundle.widgetIds.length;

    return {
        isReady: supportedCount === totalCount,
        percentage: totalCount > 0 ? Math.round((supportedCount / totalCount) * 100) : 0,
        supportedCount,
        totalCount,
        supportedWidgetIds
    };
};

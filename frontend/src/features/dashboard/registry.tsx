/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { lazy } from 'react';
import { z } from 'zod';
import type { WidgetProps } from './config';
import {
    type WidgetManifest
} from './registry.types';
import {
    ProductionChartSchema,
    ProductionChartDataSchema,
    LineEfficiencySchema,
    LineEfficiencyDataSchema,
    TargetRealizationSchema,
    TargetRealizationDataSchema,
    EarnedMinutesSchema,
    EarnedMinutesDataSchema,
    ProductionTimelineSchema,
    TimelineDataSchema,
    SamPerformanceSchema,
    SamPerformanceDataSchema,
    DhuQualitySchema,
    DhuQualityDataSchema,
    SpeedQualitySchema,
    SpeedQualityDataSchema,
    ComplexityImpactSchema,
    ComplexityDataSchema,
    BlockerCloudSchema,
    DowntimeDataSchema,
    StyleProgressSchema,
    StyleProgressDataSchema,
    WorkforceSchema,
    WorkforceDataSchema,
    KpiSummarySchema,
    KpiSummaryDataSchema
} from './registry.schemas';
import { LEGACY_ALIASES } from './registry.constants';
import * as helpers from './registry.helpers';

// Lazy load widget components
const ProductionChart = lazy(() => import('./widgets/ProductionChart')) as React.ComponentType<any>;
const DhuQualityChart = lazy(() =>
    import('./widgets/DhuQualityChart').then(module => ({ default: module.DhuQualityChart }))
);
const LineEfficiencyGauge = lazy(() => import('./widgets/LineEfficiencyGauge'));
const ProductionTimeline = lazy(() => import('./widgets/ProductionTimeline'));
const SamPerformanceMetric = lazy(() => import('./widgets/SamPerformanceMetric'));
const WorkforceAttendance = lazy(() => import('./widgets/WorkforceAttendance'));
const StyleProgressWidget = lazy(() => import('./widgets/StyleProgressWidget'));
const ComplexityImpactWidget = lazy(() => import('./widgets/ComplexityImpactWidget'));
const SpeedQualityWidget = lazy(() => import('./widgets/SpeedQualityWidget'));
const TargetRealizationWidget = lazy(() => import('./widgets/TargetRealizationWidget'));
const EarnedMinutesWidget = lazy(() => import('./widgets/EarnedMinutesWidget'));
const BlockerCloudWidget = lazy(() => import('./widgets/BlockerCloudWidget'));
const KpiSummaryWidget = lazy(() => import('./widgets/KpiSummaryWidget')) as React.ComponentType<any>;

// --- 3. The Single Source of Truth List ---

export const ALL_WIDGETS: WidgetManifest<unknown>[] = [
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
        dataId: 'production_history',
        dataSchema: ProductionChartDataSchema,
        requirements: { rawColumns: ['actual_qty', 'planned_qty'] },
        filterSubscription: { dateRange: true, productionLine: true },
        version: 1,
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
        dataSchema: LineEfficiencyDataSchema,
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
        dataSchema: DhuQualityDataSchema,
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
        layout: { w: 3, h: 6, minW: 2, minH: 6 },
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
        dataSchema: KpiSummaryDataSchema,
        requirements: { computedMetrics: ['line_efficiency', 'actual_qty'] },
        filterSubscription: { dateRange: true, shift: true, productionLine: true },
        version: 1,
        locked: true,
    }
];

// --- 4. Registry Object ---

export const WIDGET_REGISTRY: Record<string, React.ComponentType<WidgetProps>> = ALL_WIDGETS.reduce((acc, w) => {
    acc[w.id] = w.component as React.ComponentType<WidgetProps>;
    return acc;
}, {} as Record<string, React.ComponentType<WidgetProps>>);

// Add Legacy Aliases
Object.entries(LEGACY_ALIASES).forEach(([alias, targetId]) => {
    const target = ALL_WIDGETS.find(w => w.id === targetId);
    if (target) {
        WIDGET_REGISTRY[alias] = target.component as React.ComponentType<WidgetProps>;
    }
});

WIDGET_REGISTRY['stats'] = ({ w, h }: any) => (
    <div className="p-4 text-center text-gray-500">Stats Widget ({w}x{h})</div>
);

// --- 5. Exported Helpers (Wrappers around pure helpers) ---

export const getWidgetManifest = (id: string) => helpers.getWidgetManifest(id, ALL_WIDGETS);
export const getWidgetSchema = (id: string) => {
    const manifest = getWidgetManifest(id);
    return manifest ? manifest.settingsSchema : z.unknown();
};
export const getWidgetComponent = (widgetId: string) => {
    return WIDGET_REGISTRY[widgetId] || (() => <div className="p-4 text-red-500">Unknown Widget {widgetId}</div>);
};
export const isValidWidgetType = (widgetType: string): boolean => widgetType in WIDGET_REGISTRY;
export { resolveWidgetType } from './services/WidgetService';

export const getWidgetLayout = (widgetType: string, x: number, y: number) =>
    helpers.getWidgetLayout(widgetType, x, y, ALL_WIDGETS);

export const WIDGET_DEFINITIONS = ALL_WIDGETS.map(w => ({
    id: w.id,
    ...w.meta,
    defaultW: w.layout.w,
    defaultH: w.layout.h
}));

export const getCompatibilityStatus = (id: string, fields: string[]) =>
    helpers.getCompatibilityStatus(id, fields, ALL_WIDGETS);

export const getBundleReadiness = (bundleId: string, fields: string[]) =>
    helpers.getBundleReadiness(bundleId, fields, ALL_WIDGETS);

export { WIDGET_BUNDLES } from './registry.constants';
export type { WidgetManifest, WidgetCategory, WidgetBundle, BundleReadiness, CompatibilityStatus } from './registry.types';

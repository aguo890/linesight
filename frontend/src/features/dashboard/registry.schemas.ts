/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import { decimalField, optionalDecimalField } from '@/lib/schemaHelpers';

export const CommonSettingsSchema = z.object({
    customTitle: z.string().optional().describe("Widget Title"),
    refreshRate: z.number().min(0).default(0).describe("Auto-Refresh (sec)"),
    version: z.number().optional(),
});

export const ProductionChartSchema = CommonSettingsSchema.extend({
    showLegend: z.boolean().default(true).describe("Show Legend"),
    yAxisMax: z.number().default(0).describe("Y-Axis Max (0=Auto)"),
});

export const ProductionChartDataSchema = z.object({
    data_points: z.array(z.object({
        day: z.string(),
        actual: z.number(),
        target: z.number()
    })),
    line_filter: z.string().nullable().optional()
});

export const DhuQualitySchema = CommonSettingsSchema.extend({
    maxAcceptableDHU: z.number().default(2.5).describe("Max Acceptable DHU (%)"),
    showThresholdLine: z.boolean().default(true).describe("Show Threshold Line"),
});

export const DhuQualityDataSchema = z.array(z.object({
    date: z.string(),
    dhu: decimalField
}));

export const LineEfficiencySchema = CommonSettingsSchema.extend({
    targetPercentage: z.number().default(85).describe("Efficiency Target (%)"),
    showStatus: z.boolean().default(true).describe("Show Status Text"),
});

export const LineEfficiencyDataSchema = z.object({
    currentEfficiency: z.number().optional(),
    targetEfficiency: z.number().optional(),
    trend: z.number().optional(),
    status: z.enum(['on-track', 'at-risk', 'behind']).optional(),
    avg_efficiency: optionalDecimalField,
    efficiency_change_pct: optionalDecimalField,
}).passthrough();

export const ProductionTimelineSchema = CommonSettingsSchema.extend({
    showHourlyTarget: z.boolean().default(true).describe("Show Hourly Target"),
    hourlyTarget: z.number().default(100).describe("Hourly Target"),
});

export const TimelineDataSchema = z.union([
    z.array(z.number()),
    z.array(z.object({
        hour: z.string().optional(),
        time: z.string().optional(),
        actual: z.number(),
        target: z.number().optional(),
    }))
]);

export const SamPerformanceSchema = CommonSettingsSchema.extend({
    showTrend: z.boolean().default(true).describe("Show Trend Arrow"),
});

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

export const WorkforceSchema = CommonSettingsSchema.extend({
    showBreakdown: z.boolean().default(true).describe("Show Breakdown"),
    expectedOperators: z.number().default(0).describe("Expected Operators"),
    expectedHelpers: z.number().default(0).describe("Expected Helpers"),
});

export const WorkforceDataSchema = z.object({
    present: z.number(),
    target: z.number(),
    absent: z.number(),
    late: z.number(),
});

export const StyleProgressSchema = CommonSettingsSchema.extend({
    showPercentage: z.boolean().default(true).describe("Show Completion %"),
    sortBy: z.enum(['progress', 'name', 'quantity']).default('progress').describe("Sort By"),
});

export const StyleProgressDataSchema = z.object({
    active_styles: z.array(z.object({
        style_code: z.string(),
        target: z.number(),
        actual: z.number(),
        progress_pct: decimalField,
        status: z.string(),
    }))
});

export const ComplexityImpactSchema = CommonSettingsSchema.extend({
    showTrendLine: z.boolean().default(true).describe("Show Trend Line"),
    highlightOutliers: z.boolean().default(true).describe("Highlight Outliers"),
});

export const ComplexityDataSchema = z.object({
    data_points: z.array(z.object({
        style_id: z.string(),
        sam: decimalField,
        efficiency_pct: decimalField,
        style_code: z.string(),
    }))
});

export const SpeedQualitySchema = CommonSettingsSchema.extend({
    showQuadrantLabels: z.boolean().default(true).describe("Show Quadrant Labels"),
    efficiencyThreshold: z.number().default(85).describe("Efficiency Threshold (%)"),
    dhuThreshold: z.number().default(2.5).describe("DHU Threshold (%)"),
});

export const SpeedQualityDataSchema = z.object({
    data_points: z.array(z.object({
        date: z.string(),
        efficiency_pct: decimalField,
        defects_per_hundred: decimalField,
    }))
});

export const TargetRealizationSchema = CommonSettingsSchema.extend({
    showVariance: z.boolean().default(true).describe("Show Variance Badge"),
});

export const TargetRealizationDataSchema = z.object({
    actual: z.number(),
    target: z.number(),
    percentage: decimalField,
    variance: z.number(),
});

export const EarnedMinutesSchema = CommonSettingsSchema.extend({
    showEfficiency: z.boolean().default(true).describe("Show Efficiency %"),
    targetEfficiency: z.number().default(85).describe("Target Efficiency (%)"),
});

export const EarnedMinutesDataSchema = z.object({
    earned_minutes: decimalField,
    total_available_minutes: decimalField,
    efficiency_pct_aggregate: decimalField,
});

export const BlockerCloudSchema = CommonSettingsSchema.extend({
    maxItems: z.number().default(10).describe("Max Items Shown"),
    showCounts: z.boolean().default(true).describe("Show Occurrence Counts"),
});

export const DowntimeDataSchema = z.object({
    reasons: z.array(z.object({
        reason: z.string(),
        count: z.number(),
    }))
});

export const KpiSummarySchema = CommonSettingsSchema.extend({
    showTrends: z.boolean().default(true).describe("Show Trend Indicators"),
});

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

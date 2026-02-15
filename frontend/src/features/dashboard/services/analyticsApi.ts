/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Analytics API Configuration
 * 
 * This file is the SINGLE SOURCE OF TRUTH for all analytics endpoint URLs.
 * Types are imported from the dedicated types file.
 * 
 * To add a new endpoint:
 * 1. Add the URL to ANALYTICS_ENDPOINTS
 * 2. Add the dataId mapping in useWidgetData.ts ENDPOINT_MAP
 */

// Re-export types from the canonical location
export { type FilterParams, type ShiftType, type GlobalFilters } from '../../../types/analytics';

/**
 * Centralized endpoint URL constants.
 * Using constants eliminates "magic strings" and enables:
 * - Autocomplete/Intellisense
 * - Single point of change for refactoring
 * - Type-safe endpoint references
 */
export const ANALYTICS_ENDPOINTS = {
    // Efficiency & Production
    productionChart: '/analytics/production-chart',
    overview: '/analytics/overview',
    targetRealization: '/analytics/target-realization',
    earnedMinutes: '/analytics/earned-minutes',
    hourlyProduction: '/analytics/hourly-production',
    samPerformance: '/analytics/sam-performance',

    // Quality & Defects
    dhuQuality: '/analytics/dhu',
    speedQuality: '/analytics/speed-quality',
    complexity: '/analytics/complexity',

    // Operations
    downtime: '/analytics/downtime-reasons',
    styleProgress: '/analytics/production/styles',

    // Workforce
    workforce: '/analytics/workforce',
} as const;

/** Type for endpoint keys */
export type AnalyticsEndpointKey = keyof typeof ANALYTICS_ENDPOINTS;



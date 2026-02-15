/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Analytics Type Definitions
 * 
 * Shared types for analytics API parameters and responses.
 * This file is the source of truth for filter parameters used across the dashboard.
 */

/**
 * Shift types supported by the production system
 */
export type ShiftType = 'ALL' | 'Morning' | 'Evening' | 'Night';

/**
 * Standard filter parameters for all analytics endpoints.
 * All fields are optional to support partial filtering.
 */
export interface FilterParams {
    /** Production line ID to filter by */
    line_id?: string;
    /** Start date in ISO format (YYYY-MM-DD) */
    date_from: string;
    /** End date in ISO format (YYYY-MM-DD) */
    date_to: string;
    /** Shift filter */
    shift?: ShiftType;
    /** Limit number of results */
    limit?: number;
}

/**
 * Global filter state used by the dashboard context
 */
export interface GlobalFilters {
    dateRange: {
        start: Date;
        end: Date;
    };
    shift: ShiftType;
}

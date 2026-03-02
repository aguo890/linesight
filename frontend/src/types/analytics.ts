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
 * Global filter state used by the dashboard context
 */
export interface GlobalFilters {
    dateRange: {
        start: Date;
        end: Date;
    };
    shift: ShiftType;
}

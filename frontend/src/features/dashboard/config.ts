/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */


// The object saved in your database (or local state)
export interface DashboardWidgetConfig<T = any> {
    i: string;       // Unique Instance ID (e.g., "uuid-1234")
    widget: string;  // Component Type ID (e.g., "production-chart")
    x: number;       // Grid X Position
    y: number;       // Grid Y Position
    w: number;       // Width in Grid Units
    h: number;       // Height in Grid Units
    settings?: T;    // Instance-specific configuration (Generic)
}

// Re-export ValidatedWidgetConfig from WidgetService for convenience
export type { ValidatedWidgetConfig } from './services/WidgetService';

// Global filters passed to all widgets from the dashboard context
export interface GlobalFilters {
    dateRange: { start: Date; end: Date };
    shift: string; // 'ALL' | 'Morning' | 'Evening' | 'Night'
}

export interface WidgetProps {
    id?: string;
    w: number;
    h: number;
    editMode?: boolean;
    onRemove?: () => void;
    productionLineId?: string; // Reverted to string to match API
    dataSourceId?: string;
    className?: string;
    demoData?: any; // For bypassing API fetching (e.g., showcases)
    settings?: Record<string, any>; // Instance-specific configuration (Phase 4)
    globalFilters?: GlobalFilters; // Dashboard-wide filters (Phase 5)
}

// V2 "Smart" Widget Props
export interface SmartWidgetProps<TData = unknown, TSettings = unknown> {
    id?: string;
    data: TData;
    isLoading: boolean;
    error: string | null;
    isMock: boolean;
    settings: TSettings;
    globalFilters: GlobalFilters;
    w: number;
    h: number;
    editMode?: boolean;
    onRemove?: () => void;
}


export interface WidgetLayoutState {
    isBanner: boolean;
    isLarge: boolean;
    isCompact: boolean;
    isWide: boolean;
    isTall: boolean;
}

export const getLayoutState = (w: number, h: number): WidgetLayoutState => ({
    isBanner: w >= 4,
    isLarge: w >= 2 && h >= 2,
    isCompact: w === 1 && h === 1,
    isWide: w >= 2,
    isTall: h >= 2,
});


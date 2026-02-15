/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { type DashboardWidgetConfig } from './config';

// --- Constants ---
export const STORAGE_KEYS = {
    DASHBOARDS: 'factory_dashboards',
    ACTIVE_ID: 'active_dashboard_id'
};

// --- Storage Types ---
export type SavedDashboard = {
    id: string;
    name: string;
    widgets: DashboardWidgetConfig[];
    createdAt: string;
    updatedAt: string;
    dataSourceId?: string;
    dataSourceName?: string;
    factoryId?: string;
    lastModified?: string;
};

// --- Global Context Types ---
export interface DateRange {
    start: Date;
    end: Date;
}

export interface GlobalFilters {
    dateRange: DateRange;
    shift: string;
}

// --- Widget Configuration ---
export interface WidgetSettingField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select' | 'color';
    defaultValue?: any;
    options?: { label: string; value: any }[];
    placeholder?: string;
}

export interface WidgetDefinition {
    id: string;
    title: string;
    description?: string;
    minW: number;
    minH: number;
    defaultW: number;
    defaultH: number;
    component: React.ComponentType<WidgetProps>; // Uses the prop definition below
    settingsSchema?: WidgetSettingField[];
    dataId?: string;
    category?: string;
    tags?: string[];
    priority?: number;
    requiredRawColumns?: string[];
    requiredComputedMetrics?: string[];
}

// --- Component Props ---
export interface WidgetProps {
    // Grid Dimensions
    w?: number;
    h?: number;

    // Data Context
    productionLineId?: string;

    // Configuration
    settings?: Record<string, any>;
    globalFilters?: GlobalFilters;

    // Metadata
    widgetId?: string;

    // Demo Data (for Landing Page/Previews)
    demoData?: any;
}

// --- New Dashboard API Types (from previous file content, preserved for safety) ---

export interface LayoutItem {
    widget_id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface WidgetConfig {
    enabled_widgets: string[];
    widget_settings?: Record<string, any>;
}

export interface LayoutConfig {
    layouts: LayoutItem[];
}

export interface Dashboard {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    data_source_id?: string;
    production_line_id?: string;
    widget_config?: string; // JSON string from backend
    layout_config?: string; // JSON string from backend
    created_at: string;
    updated_at: string;
}

export interface DashboardDetailResponse extends Dashboard {
    widget_data?: Record<string, any>;
}

export interface DashboardCreateRequest {
    name: string;
    description?: string;
    data_source_id?: string;
    production_line_id?: string;
    widget_config?: WidgetConfig;
    layout_config?: LayoutConfig;
}

export interface DashboardUpdateRequest {
    name?: string;
    description?: string;
    data_source_id?: string;
    production_line_id?: string;
    widget_config?: WidgetConfig;
    layout_config?: LayoutConfig;
}

export interface DashboardListResponse {
    dashboards: Dashboard[];
    count: number;
}

// Widget Suggestion Types

export interface SuggestedWidget {
    widget_type: string;
    reason: string;
    confidence: number;
    data_mapping: Record<string, string>;
}

export interface WidgetSuggestionsResponse {
    suggested_widgets: SuggestedWidget[];
}

// Dashboard Creation Wizard State

export type WizardStep = 'setup' | 'data-source' | 'preview' | 'processing' | 'widget-selection';

export type DataSourceType = 'upload' | 'existing';

export interface DashboardCreationState {
    step: WizardStep;
    dashboardName: string;
    dashboardDescription: string;
    dataSourceType: DataSourceType;
    selectedFileId: string | null;
    processingJobId: string | null;
    suggestedWidgets: SuggestedWidget[];
    selectedWidgets: string[];
}

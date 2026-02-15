/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Dashboard API client for LineSight.
 * Fetches analytics data for dashboard widgets.
 */
import api from './api';

// ============================================================================
// Types
// ============================================================================

// ============================================================================
// Types
// ============================================================================
// Analytics types moved to analyticsApi.ts

// ============================================================================
// API Functions
// ============================================================================

// Analytics functions moved to analyticsApi.ts used by widgetDataService.ts

// ============================================================================
// Dashboard CRUD API Functions
// ============================================================================

import type {
    Dashboard,
    DashboardCreateRequest,
    DashboardUpdateRequest,
    DashboardListResponse,
    DashboardDetailResponse,
    WidgetSuggestionsResponse,
} from '../features/dashboard/types';

/**
 * Create a new dashboard.
 */
export async function createDashboard(data: DashboardCreateRequest): Promise<Dashboard> {
    const response = await api.post<Dashboard>('/dashboards/', data);
    return response.data;
}

/**
 * Get list of user's dashboards.
 */
export async function listDashboards(factoryId?: string): Promise<DashboardListResponse> {
    const params = factoryId ? { factory_id: factoryId } : {};
    const response = await api.get<DashboardListResponse>('/dashboards/', { params });
    return response.data;
}

/**
 * Get a specific dashboard by ID with widget data.
 */
export async function getDashboard(dashboardId: string): Promise<DashboardDetailResponse> {
    const response = await api.get<DashboardDetailResponse>(`/dashboards/${dashboardId}`);
    return response.data;
}

/**
 * Update an existing dashboard.
 */
export async function updateDashboard(
    dashboardId: string,
    data: DashboardUpdateRequest
): Promise<Dashboard> {
    const response = await api.put<Dashboard>(`/dashboards/${dashboardId}`, data);
    return response.data;
}

/**
 * Delete a dashboard.
 */
export async function deleteDashboard(dashboardId: string): Promise<void> {
    await api.delete(`/dashboards/${dashboardId}`);
}

/**
 * Get AI-suggested widgets for an uploaded file.
 * File must be processed before suggestions can be generated.
 */
export async function suggestWidgets(fileId: string): Promise<WidgetSuggestionsResponse> {
    const response = await api.post<WidgetSuggestionsResponse>(`/uploads/${fileId}/suggest-widgets`);
    return response.data;
}


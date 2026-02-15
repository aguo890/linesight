/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * useDashboards Hook
 * 
 * Provides dashboard data fetching and CRUD operations with React Query.
 * Abstracts localStorage-based storage and API calls from components.
 */
import { useState, useEffect, useCallback } from 'react';
import { dashboardStorage } from '../features/dashboard/storage';
import type { SavedDashboard } from '../features/dashboard/types';
import type { DashboardWidgetConfig } from '../features/dashboard/config';

// =============================================================================
// Types
// =============================================================================

export interface UseDashboardsOptions {
    /** Auto-refresh dashboards on storage changes */
    autoRefresh?: boolean;
}

export interface UseDashboardsReturn {
    /** List of all dashboards */
    dashboards: SavedDashboard[];
    /** Currently active dashboard ID */
    activeId: string;
    /** Loading state */
    isLoading: boolean;
    /** Create a new dashboard */
    createDashboard: (name: string, widgets?: DashboardWidgetConfig[]) => SavedDashboard;
    /** Update widgets for a dashboard */
    updateWidgets: (id: string, widgets: DashboardWidgetConfig[]) => void;
    /** Delete a dashboard */
    deleteDashboard: (id: string) => void;
    /** Set the active dashboard */
    setActiveId: (id: string) => void;
    /** Get a dashboard by ID */
    getDashboard: (id: string) => SavedDashboard | undefined;
    /** Refresh dashboards from storage */
    refresh: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing dashboard data and operations.
 * 
 * @example
 * ```tsx
 * const { dashboards, createDashboard, deleteDashboard } = useDashboards();
 * 
 * // Create new dashboard
 * const newDashboard = createDashboard('My Dashboard');
 * 
 * // Delete dashboard
 * deleteDashboard(dashboardId);
 * ```
 */
export function useDashboards(options: UseDashboardsOptions = {}): UseDashboardsReturn {
    const { autoRefresh = true } = options;

    const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
    const [activeId, setActiveIdState] = useState<string>('default');
    const [isLoading, setIsLoading] = useState(true);

    // Load dashboards from storage
    const loadDashboards = useCallback(() => {
        try {
            const stored = dashboardStorage.getDashboards();
            const currentActiveId = dashboardStorage.getActiveId();
            setDashboards(stored);
            setActiveIdState(currentActiveId);
        } catch (error) {
            console.error('Failed to load dashboards:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadDashboards();
    }, [loadDashboards]);

    // Listen for storage updates
    useEffect(() => {
        if (!autoRefresh) return;

        const handleStorageChange = () => {
            loadDashboards();
        };

        window.addEventListener('dashboards-updated', handleStorageChange);
        return () => {
            window.removeEventListener('dashboards-updated', handleStorageChange);
        };
    }, [autoRefresh, loadDashboards]);

    // Create dashboard
    const createDashboard = useCallback((
        name: string,
        widgets?: DashboardWidgetConfig[]
    ): SavedDashboard => {
        const newDashboard = dashboardStorage.createDashboard(name, widgets);
        loadDashboards(); // Refresh
        return newDashboard;
    }, [loadDashboards]);

    // Update widgets
    const updateWidgets = useCallback((id: string, widgets: DashboardWidgetConfig[]) => {
        dashboardStorage.updateDashboardWidgets(id, widgets);
        loadDashboards(); // Refresh
    }, [loadDashboards]);

    // Delete dashboard
    const deleteDashboard = useCallback((id: string) => {
        dashboardStorage.deleteDashboard(id);
        loadDashboards(); // Refresh
    }, [loadDashboards]);

    // Set active dashboard
    const setActiveId = useCallback((id: string) => {
        dashboardStorage.setActiveId(id);
        setActiveIdState(id);
    }, []);

    // Get dashboard by ID
    const getDashboard = useCallback((id: string): SavedDashboard | undefined => {
        return dashboards.find(d => d.id === id);
    }, [dashboards]);

    return {
        dashboards,
        activeId,
        isLoading,
        createDashboard,
        updateWidgets,
        deleteDashboard,
        setActiveId,
        getDashboard,
        refresh: loadDashboards,
    };
}

// =============================================================================
// Single Dashboard Hook
// =============================================================================

export interface UseDashboardReturn {
    dashboard: SavedDashboard | undefined;
    isLoading: boolean;
    updateWidgets: (widgets: DashboardWidgetConfig[]) => void;
    deleteDashboard: () => void;
}

/**
 * Hook for managing a single dashboard by ID.
 * 
 * @example
 * ```tsx
 * const { dashboard, updateWidgets } = useDashboard(dashboardId);
 * ```
 */
export function useDashboard(dashboardId: string): UseDashboardReturn {
    const {
        getDashboard,
        updateWidgets: updateAll,
        deleteDashboard: deleteAll,
        isLoading
    } = useDashboards();

    const dashboard = getDashboard(dashboardId);

    const updateWidgets = useCallback((widgets: DashboardWidgetConfig[]) => {
        updateAll(dashboardId, widgets);
    }, [dashboardId, updateAll]);

    const deleteDashboard = useCallback(() => {
        deleteAll(dashboardId);
    }, [dashboardId, deleteAll]);

    return {
        dashboard,
        isLoading,
        updateWidgets,
        deleteDashboard,
    };
}

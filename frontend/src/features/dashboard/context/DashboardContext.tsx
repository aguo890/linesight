import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { DashboardWidgetConfig, GlobalFilters } from '../config';
import type { DateRange } from 'react-day-picker';



const STORAGE_KEY = 'vdm_dashboard_state_v2';

import type { Dispatch, SetStateAction } from 'react';
// Layout item shape for react-grid-layout
interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

// Default widgets from your registry
const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
    { i: 'prod-1', widget: 'production-chart', x: 0, y: 0, w: 2, h: 2 },
    { i: 'kpi-1', widget: 'kpi-summary', x: 2, y: 0, w: 2, h: 1 },
    { i: 'efficiency-1', widget: 'line-efficiency', x: 0, y: 2, w: 1, h: 2 },
];

// Default layout mirrors the widgets
const DEFAULT_LAYOUT: LayoutItem[] = DEFAULT_WIDGETS.map(w => ({
    i: w.i,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
}));

// Default global filters
const DEFAULT_FILTERS: GlobalFilters = {
    dateRange: {
        start: new Date(new Date().setDate(new Date().getDate() - 7)),
        end: new Date(),
    },
    shift: 'ALL',
};

interface DashboardContextValue {
    // Layout State
    layout: LayoutItem[];
    setLayout: Dispatch<SetStateAction<LayoutItem[]>>;

    // Widget Configuration
    widgets: DashboardWidgetConfig[];
    setWidgets: Dispatch<SetStateAction<DashboardWidgetConfig[]>>;

    // Global Filters
    globalFilters: GlobalFilters;
    setGlobalFilters: (filters: GlobalFilters) => void;
    updateDateRange: (range: DateRange | undefined) => void;
    updateShift: (shift: string) => void;

    // Refresh Trigger
    lastRefreshAt: number;
    triggerRefresh: () => void;
    resetDashboard: () => void;

    // Global UI State (Sidebars)
    activePanel: 'add' | 'settings' | null;
    openSettings: (id: string) => void;
    openLibrary: () => void;
    closePanels: () => void;

    // Widget Settings Editor
    editingWidgetId: string | null;
    updateWidgetSettings: (id: string, newSettings: any) => void;

    // Dashboard Metadata
    productionLineId?: string;
    setProductionLineId: (id: string | undefined) => void;

    dataSourceId?: string;
    setDataSourceId: (id: string | undefined) => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

interface DashboardProviderProps {
    children: ReactNode;
    productionLineId?: string;
    dataSourceId?: string;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({
    children,
    productionLineId: initialProductionLineId,
    dataSourceId: initialDataSourceId,
}) => {
    // Hydrate widgets from localStorage
    const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.version === 2 && parsed.widgets) {
                    return parsed.widgets;
                }
            } catch (e) {
                console.error("Failed to hydrate widgets", e);
            }
        }
        return DEFAULT_WIDGETS;
    });

    // Global UI State
    const [activePanel, setActivePanel] = useState<'add' | 'settings' | null>(null);
    const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

    // Hydrate layout from localStorage
    const [layout, setLayout] = useState<LayoutItem[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.version === 2 && parsed.layout) {
                    return parsed.layout;
                }
            } catch (e) {
                console.error("Failed to hydrate layout", e);
            }
        }
        return DEFAULT_LAYOUT;
    });

    // Hydrate global filters from localStorage
    const [globalFilters, setGlobalFilters] = useState<GlobalFilters>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.version === 2 && parsed.globalFilters) {
                    // Parse date strings back to Date objects
                    return {
                        ...parsed.globalFilters,
                        dateRange: {
                            start: new Date(parsed.globalFilters.dateRange.start),
                            end: new Date(parsed.globalFilters.dateRange.end),
                        },
                    };
                }
            } catch (e) {
                console.error("Failed to hydrate global filters", e);
            }
        }
        return DEFAULT_FILTERS;
    });

    const [lastRefreshAt, setLastRefreshAt] = useState(Date.now());
    const [productionLineId, setProductionLineId] = useState<string | undefined>(initialProductionLineId);
    const [dataSourceId, setDataSourceId] = useState<string | undefined>(initialDataSourceId);

    // Optimized Persistence Effect - Debounced 500ms to prevent spam
    useEffect(() => {
        const timer = setTimeout(() => {
            const stateToSave = {
                version: 2,
                widgets,
                layout,
                globalFilters,
                productionLineId,
                dataSourceId,
                savedAt: new Date().toISOString(),
            };

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
                console.log('💾 Dashboard state persisted (debounced)');
            } catch (e) {
                console.error("Failed to persist dashboard state", e);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [widgets, layout, globalFilters, productionLineId, dataSourceId]);

    const queryClient = useQueryClient();

    const triggerRefresh = () => {
        console.log('[DashboardContext] Refresh triggered');
        queryClient.invalidateQueries({ queryKey: ['widget-data'] });
        setLastRefreshAt(Date.now());
    };

    const resetDashboard = () => {
        console.log('[DashboardContext] Resetting dashboard state');
        // Reset to defaults but preserve context (Production Line / Data Source)
        setWidgets(DEFAULT_WIDGETS);
        setLayout(DEFAULT_LAYOUT);
        setGlobalFilters(DEFAULT_FILTERS);
        // Clear local storage logic will handle the update via the useEffect
    };

    const openSettings = (id: string) => {
        setEditingWidgetId(id);
        setActivePanel('settings');
    };

    const openLibrary = () => {
        setEditingWidgetId(null);
        setActivePanel('add');
    };

    const closePanels = () => {
        setEditingWidgetId(null);
        setActivePanel(null);
    };

    const updateWidgetSettings = (id: string, newSettings: any) => {
        setWidgets(prev => prev.map(w =>
            w.i === id ? { ...w, settings: { ...w.settings, ...newSettings } } : w
        ));
    };

    const updateDateRange = (range: DateRange | undefined) => {
        setGlobalFilters(prev => ({
            ...prev,
            dateRange: {
                start: range?.from || prev.dateRange.start,
                end: range?.to || prev.dateRange.end
            }
        }));
    };

    const updateShift = (shift: string) => {
        setGlobalFilters(prev => ({ ...prev, shift }));
    };


    const value: DashboardContextValue = {
        layout,
        setLayout,
        widgets,
        setWidgets,
        globalFilters,
        setGlobalFilters,
        lastRefreshAt,
        triggerRefresh,
        resetDashboard,
        activePanel,
        openSettings,
        openLibrary,
        closePanels,
        editingWidgetId,
        updateWidgetSettings,
        updateDateRange,
        updateShift,
        productionLineId,
        setProductionLineId,
        dataSourceId,
        setDataSourceId,
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};

// 4. Custom Hooks for consumption

/**
 * Standard hook for dashboard state.
 * Throws an error if used outside of DashboardProvider.
 * Use this for "Core" dashboard components that require state to function.
 */
export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
};

/**
 * "Safe" version of useDashboard for UI components that might be rendered 
 * in a static/preview context (like the Landing Page).
 * Returns undefined if no provider is present.
 */
export const useDashboardSafe = () => {
    return useContext(DashboardContext);
};


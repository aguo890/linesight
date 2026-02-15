
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { DashboardWidgetConfig } from '../config';
import { MainLayout } from '@/components/layout/MainLayout';
import { dashboardStorage } from '../storage';
import { WidgetLibrary } from '@/components/WidgetLibrary';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { DashboardEmptyState } from '@/components/DashboardEmptyState';

import { DashboardFilterBar } from '@/components/DashboardFilterBar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardGridLayout } from '@/components/DashboardGridLayout';
import { WidgetRenderer } from '@/components/WidgetRenderer';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import type { SavedDashboard } from '../types';
import { validateWidgetConfigs } from '../services/WidgetService';
import { getWidgetLayout } from '../registry';
import { useDashboard } from '../context/DashboardContext';


import { useIsFetching } from '@tanstack/react-query';



const DashboardPageContent = () => {

    // NEW: Global Loading Pulse Bar tracking exactly 'widget-data'
    const fetchingCount = useIsFetching({ queryKey: ['widget-data'] });

    // NEW: Consume DashboardContext
    const {
        widgets, setWidgets,
        activePanel, openLibrary, closePanels,
        productionLineId, setProductionLineId
    } = useDashboard();

    const { factoryId: factoryIdFromUrl, dashboardId: dashboardIdFromUrl } = useParams<{ factoryId: string; dashboardId: string }>();
    const navigate = useNavigate();

    const [editMode, setEditMode] = useState(false);
    const [activeDashboard, setActiveDashboard] = useState<SavedDashboard | null>(null);
    // REMOVED local productionLineId
    const [factoryId, setFactoryId] = useState<string | undefined>(factoryIdFromUrl);
    const [factoryName, setFactoryName] = useState<string | undefined>(undefined);
    const [availableFields, setAvailableFields] = useState<Set<string>>(new Set());
    // Visual "live" indicator - updated by global filter context or periodic fetches
    const [lastUpdated] = useState(new Date().toLocaleTimeString());
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

    useEffect(() => {
        const updateDirection = () => {
            const dir = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
            setDirection(dir);
        };
        updateDirection();
        const observer = new MutationObserver(updateDirection);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
        return () => observer.disconnect();
    }, []);



    const loadDashboard = useCallback(async () => {
        setIsLoading(true);
        // Prefer URL parameter, fallback to storage activeId
        const targetId = dashboardIdFromUrl || dashboardStorage.getActiveId();

        // If we have a specific ID (not 'default'), try to fetch from database first
        if (targetId && targetId !== 'default') {
            try {
                const { getDashboard } = await import('../../../lib/dashboardApi');
                const dashboardData = await getDashboard(targetId);

                // Parse the layout and create a SavedDashboard object
                const layoutConfig = dashboardData.layout_config ? JSON.parse(dashboardData.layout_config as string) : null;

                console.log('🔍 Raw layout config from API:', {
                    raw: dashboardData.layout_config,
                    parsed: layoutConfig,
                    layouts: layoutConfig?.layouts
                });

                // Fetch data source name if available
                let dataSourceName = 'No data source';
                if (dashboardData.data_source_id) {
                    try {
                        const { getDataSource } = await import('../../../lib/datasourceApi');
                        const dsData = await getDataSource(dashboardData.data_source_id);
                        dataSourceName = dsData.source_name;
                        setProductionLineId(dsData.production_line_id);

                        // Fetch factory ID from production line
                        if (dsData.production_line_id) {
                            const { getProductionLine } = await import('../../../lib/factoryApi');
                            const lineData = await getProductionLine(dsData.production_line_id);
                            setFactoryId(lineData.factory_id);

                            // Fetch factory name for breadcrumb
                            const { getFactory } = await import('../../../lib/factoryApi');
                            const factoryData = await getFactory(lineData.factory_id);
                            setFactoryName(factoryData.name);
                        }

                        // Extract available fields from active schema mapping
                        if (dsData.schema_mappings && dsData.schema_mappings.length > 0) {
                            const activeMapping = dsData.schema_mappings.find(m => m.is_active) || dsData.schema_mappings[0];
                            if (activeMapping && activeMapping.column_map) {
                                // column_map is Source -> Canonical
                                const rawColumnMap = activeMapping.column_map;
                                const columnMap = typeof rawColumnMap === 'string' ? JSON.parse(rawColumnMap) : rawColumnMap;
                                const fields = new Set(Object.values(columnMap));
                                console.log('✅ Available Canonical Fields (API path):', Array.from(fields));
                                setAvailableFields(fields as Set<string>);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to fetch data source:', error);
                    }
                }

                // Transform API widgets to internal format with auto-migration
                const parsedWidgets = layoutConfig?.layouts
                    ? validateWidgetConfigs(layoutConfig.layouts)
                    : [];

                const board: SavedDashboard = {
                    id: dashboardData.id,
                    name: dashboardData.name,
                    widgets: parsedWidgets,
                    dataSourceId: dashboardData.data_source_id,
                    dataSourceName,
                    createdAt: dashboardData.created_at,
                    updatedAt: dashboardData.updated_at,
                    lastModified: dashboardData.updated_at
                };

                console.log('📊 Dashboard loaded from API:', {
                    id: board.id,
                    name: board.name,
                    dataSourceId: board.dataSourceId,
                    dataSourceName: board.dataSourceName,
                    widgetCount: board.widgets.length
                });

                setActiveDashboard(board);
                setWidgets(board.widgets);
                document.title = `${board.name} | LineSight`;
                dashboardStorage.setActiveId(board.id);
                return;
            } catch (error) {
                console.error('Failed to fetch dashboard from API:', error);
                // Fall through to localStorage fallback
            } finally {
                setIsLoading(false);
            }
        }

        // Fallback to localStorage for 'default' or if API fetch failed
        const boards = dashboardStorage.getDashboards();
        let board = boards.find(b => b.id === targetId) || boards[0];

        if (board) {
            console.log('📦 Dashboard loaded from localStorage:', {
                id: board.id,
                name: board.name,
                dataSourceId: board.dataSourceId,
                dataSourceName: board.dataSourceName,
                widgetCount: board.widgets?.length || 0
            });

            setActiveDashboard(board);
            setWidgets(board.widgets);
            document.title = `${board.name} | LineSight`;
            dashboardStorage.setActiveId(board.id);

            // Fetch production line ID and Name from data source if it exists
            if (board.dataSourceId) {
                try {
                    const { getDataSource } = await import('../../../lib/datasourceApi');
                    const dsData = await getDataSource(board.dataSourceId);
                    setProductionLineId(dsData.production_line_id);

                    // Fetch factory ID from production line
                    if (dsData.production_line_id) {
                        const { getProductionLine } = await import('../../../lib/factoryApi');
                        const lineData = await getProductionLine(dsData.production_line_id);
                        setFactoryId(lineData.factory_id);

                        // Fetch factory name for breadcrumb
                        const { getFactory } = await import('../../../lib/factoryApi');
                        const factoryData = await getFactory(lineData.factory_id);
                        setFactoryName(factoryData.name);
                    }

                    // Always update with the latest data source name from the API
                    if (dsData.source_name) {
                        console.log('✅ Updating dashboard with data source name:', dsData.source_name);
                        setActiveDashboard(prev => {
                            if (prev?.dataSourceName === dsData.source_name) return prev;
                            return prev ? { ...prev, dataSourceName: dsData.source_name } : null;
                        });
                    }

                    // Extract available fields from active schema mapping
                    if (dsData.schema_mappings && dsData.schema_mappings.length > 0) {
                        const activeMapping = dsData.schema_mappings.find(m => m.is_active) || dsData.schema_mappings[0];
                        if (activeMapping && activeMapping.column_map) {
                            // column_map is Source -> Canonical
                            const rawColumnMap = activeMapping.column_map;
                            const columnMap = typeof rawColumnMap === 'string' ? JSON.parse(rawColumnMap) : rawColumnMap;
                            const fields = new Set(Object.values(columnMap));
                            console.log('✅ Available Canonical Fields:', Array.from(fields));
                            setAvailableFields(fields as Set<string>);
                        }
                    }

                } catch (error) {
                    console.error('Failed to fetch data source:', error);
                    setProductionLineId(undefined);
                    setFactoryId(undefined);
                }
            } else {
                setProductionLineId(undefined);
                setFactoryId(undefined);
            }
        }
        setIsLoading(false);
    }, [dashboardIdFromUrl]);



    const saveLayoutToDatabase = async (currentWidgets: DashboardWidgetConfig[]) => {
        if (!activeDashboard || activeDashboard.id === 'default') return;

        setIsSaving(true);
        try {
            const { updateDashboard } = await import('../../../lib/dashboardApi');

            // Include settings in payload for cross-device persistence
            const layoutConfig = {
                layouts: currentWidgets.map(w => ({
                    i: w.i,
                    widget_id: w.i,
                    widget: w.widget,
                    x: w.x,
                    y: w.y,
                    w: w.w,
                    h: w.h,
                    settings: w.settings // <-- Vital for cross-device persistence
                }))
            };

            await updateDashboard(activeDashboard.id, {
                layout_config: layoutConfig
            });

            console.log('✅ Dashboard layout + settings persisted to database');
        } catch (error) {
            console.error('❌ Failed to persist dashboard layout:', error);
            // Optional: Add a toast notification here
        } finally {
            setIsSaving(false);
        }
    };

    // Load from storage on mount and when URL changes
    useEffect(() => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // If ID exists and is not 'default', validate it's a UUID
        if (dashboardIdFromUrl && dashboardIdFromUrl !== 'default' && !uuidRegex.test(dashboardIdFromUrl)) {
            navigate('/404', { replace: true });
            return;
        }

        loadDashboard();

        // Listen for dashboard switching from sidebar
        window.addEventListener('dashboard-switched', loadDashboard);
        return () => window.removeEventListener('dashboard-switched', loadDashboard);
    }, [loadDashboard]);

    // 1. Layout Change Handler
    const handleLayoutChange = useCallback((layout: readonly any[]) => {
        setWidgets((prevWidgets: DashboardWidgetConfig[]) => {
            let hasChanges = false;
            const updated = prevWidgets.map(widget => {
                const layoutItem = layout.find(l => l.i === widget.i);

                // Only update if dimensions actually changed (Prevents Infinite Render Loop)
                if (layoutItem && (
                    widget.x !== layoutItem.x ||
                    widget.y !== layoutItem.y ||
                    widget.w !== layoutItem.w ||
                    widget.h !== layoutItem.h
                )) {
                    hasChanges = true;
                    return {
                        ...widget,
                        x: layoutItem.x,
                        y: layoutItem.y,
                        w: layoutItem.w,
                        h: layoutItem.h
                    };
                }
                return widget;
            });

            // If no actual changes, return the exact same object reference to stop React re-renders
            return hasChanges ? updated : prevWidgets;
        });
    }, []);

    // Layout and persistence are now handled by DashboardContext + API saves in editMode


    // 2. Add Widget Logic (Optimized for "Creator" flow)
    const handleAddWidget = (typeId: string) => {
        // Use the Registry Helper to get standard layout
        const layoutItem = getWidgetLayout(typeId, 0, Infinity);

        // Calculate 'y' to place it at the very bottom
        // Find the maximum y + h of current widgets
        const maxY = widgets.length > 0
            ? Math.max(...widgets.map(w => w.y + w.h))
            : 0;

        const newWidget: DashboardWidgetConfig = {
            i: layoutItem.i,
            widget: layoutItem.widget,
            x: 0,
            y: maxY, // Place at bottom
            w: layoutItem.w,
            h: layoutItem.h,
            settings: {} // Initialize empty settings
        };

        setWidgets((prev: DashboardWidgetConfig[]) => [...prev, newWidget]);

        // Optional: Smooth scroll to bottom after a short delay
        setTimeout(() => {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    };



    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <MainLayout disablePadding={true}>
            <div className="min-h-screen bg-canvas flex flex-col relative overflow-hidden">
                {/* Global Loading Pulse Bar */}
                {fetchingCount > 0 && (
                    <div className="fixed top-0 start-0 end-0 h-1 bg-brand/20 z-[100] overflow-hidden">
                        <div className="h-full bg-brand animate-pulse w-full"></div>
                    </div>
                )}

                {/* Header Section */}
                <DashboardHeader
                    dashboardName={activeDashboard?.name}
                    dataSourceName={activeDashboard?.dataSourceName}
                    factoryId={factoryId}
                    factoryName={factoryName}
                    editMode={editMode}
                    onEditModeToggle={async () => {
                        if (editMode) {
                            // We are exiting - Save data
                            closePanels();
                            await saveLayoutToDatabase(widgets);
                        }
                        setEditMode(!editMode);
                    }}
                    onOpenLibrary={openLibrary}
                    isSaving={isSaving}
                    lastUpdated={lastUpdated}
                />

                {/* Global Filter Bar (Phase 5) - Persisted Logic */}
                <DashboardFilterBar />

                {/* Sidebar Widget Library */}
                <WidgetLibrary
                    isOpen={activePanel === 'add'}
                    onClose={closePanels}
                    onAddWidget={handleAddWidget}
                    availableFields={Array.from(availableFields)}
                    activeWidgets={widgets.map(w => w.widget)}
                />

                {/* Dashboard Area */}
                <main className="flex-1 p-6 relative">
                    {/* Visual Blueprint Grid (Only in Edit Mode) */}
                    {editMode && (
                        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
                    )}

                    {widgets.length === 0 ? (
                        <DashboardEmptyState onOpenDesigner={() => setEditMode(true)} />
                    ) : (
                        <DashboardGridLayout
                            key={direction}
                            widgets={widgets}
                            editMode={editMode}
                            isRTL={direction === 'rtl'}
                            onLayoutChange={handleLayoutChange}
                            renderWidget={(widget) => (
                                <WidgetRenderer
                                    widget={widget}
                                    editMode={editMode}
                                    productionLineId={productionLineId}
                                    dataSourceId={activeDashboard?.dataSourceId}
                                    onDelete={() => setWidgets(widgets.filter(x => x.i !== widget.i))}
                                />
                            )}
                        />
                    )}
                </main>
            </div>

            {/* Live Settings Sidebar (V2 Widgets) */}
            <SettingsSidebar />
        </MainLayout>
    );
};

export const DynamicDashboardPage = () => {
    return (
        <DashboardPageContent />
    );
};

export default DynamicDashboardPage;



import React, { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, LayoutGrid } from 'lucide-react';
import type { ValidatedWidgetConfig } from '../services/WidgetService';
import type { GlobalFilters } from '../config';
import { getWidgetManifest } from '../registry';
import WidgetErrorBoundary from './WidgetErrorBoundary';
import { useWidgetLogger } from '@/hooks/useWidgetLogger';
import { WidgetSkeleton } from './WidgetSkeleton';
import { useDashboard } from '../context/DashboardContext';
import { useWidgetData } from '../hooks/useWidgetData';
import { WidgetWrapper } from './WidgetWrapper';
import { ComingSoonWidget } from '../widgets/ComingSoonWidget';
import { getWidgetIcon } from '../utils/iconMap';
import { useDebouncedDimensions } from '../../../hooks/useDebouncedDimensions';

interface WidgetRendererProps {
    widget: ValidatedWidgetConfig;
    editMode: boolean;
    productionLineId?: string;
    dataSourceId?: string;
    globalFilters?: GlobalFilters; // Optional override
    onDelete?: () => void;
    width?: number;
    height?: number;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
    widget,
    editMode,
    productionLineId,
    dataSourceId,
    onDelete,
    width,
    height
}) => {
    const { t } = useTranslation();
    // 1. Get Global Context
    const { globalFilters: contextFilters } = useDashboard();

    // 2. Resolve Manifest
    const manifest = getWidgetManifest(widget.widget);

    // 3. Logger
    const { logError } = useWidgetLogger();

    // 4. Normalize Filters (Context API -> Widget API)
    const effectiveFilters: GlobalFilters = useMemo(() => ({
        dateRange: {
            start: contextFilters.dateRange?.start || new Date(),
            end: contextFilters.dateRange?.end || contextFilters.dateRange?.start || new Date()
        },
        shift: contextFilters.shift
    }), [contextFilters]);

    // 5. V2 Centralized Data Fetching
    const { data, loading, error, isMock } = useWidgetData({
        dataId: manifest?.dataId,
        filters: effectiveFilters,
        settings: widget.settings,
        productionLineId,
        dataSourceId,
        schema: manifest?.dataSchema,
        refreshInterval: (widget.settings?.refreshRate || 0) * 1000
    });

    // 6. DEBOUNCED UPDATE LOGIC ("Smart Freeze") -----------------------------------
    // Injected by DashboardGridLayout via cloneElement
    const parentWidth = width || 0;
    const parentHeight = height || 0;

    // Use the hook to debounce dimensions ONLY when in edit mode
    // If not in edit mode, we want instant resizing (delay: 0)
    const { width: debouncedW, height: debouncedH } = useDebouncedDimensions(
        parentWidth,
        parentHeight,
        editMode ? 200 : 0
    );

    const effectiveWidth = editMode ? debouncedW : parentWidth;
    const effectiveHeight = editMode ? debouncedH : parentHeight;
    // ------------------------------------------------------------------------------

    if (!manifest) {
        return (
            <div className="p-4 bg-error/10 border border-error/30 rounded text-error">
                {t('widgets.renderer.unknown_type')}: {widget.widget}
            </div>
        );
    }

    const title = widget.settings?.customTitle || manifest.meta.title;
    const IconComponent = useMemo(() => manifest.meta.icon ? getWidgetIcon(manifest.meta.icon) : undefined, [manifest.meta.icon]);
    const iconElement = useMemo(() => IconComponent ? <IconComponent className={manifest.meta.iconColor || "text-text-muted"} /> : undefined, [IconComponent, manifest.meta.iconColor]);

    // 7. Centralized Loading State
    if (loading && !data && manifest.dataId) {
        return <WidgetSkeleton />;
    }

    // 8. Centralized Error State
    if (error) {
        return (
            <WidgetWrapper id={widget.i} title={title} isMock={isMock} icon={iconElement} iconBgColor={manifest.meta.bgColor}>
                <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2 p-4 text-center">
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-xs font-medium">{t('widgets.renderer.failed_load')}</span>
                    <span className="text-[10px] opacity-70">{error}</span>
                </div>
            </WidgetWrapper>
        );
    }

    // 9. Locked State
    if (manifest.locked && !widget.settings?.unlockPreview) {
        return (
            <WidgetWrapper id={widget.i} title={title} isMock={isMock} editMode={editMode} onRemove={onDelete} icon={iconElement} iconBgColor={manifest.meta.bgColor}>
                <ComingSoonWidget
                    id={widget.i}
                    w={widget.w}
                    h={widget.h}
                    settings={widget.settings}
                    demoData={false}
                    description={manifest.meta.description}
                />
            </WidgetWrapper>
        );
    }

    // 10. Memoized Inner Widget Wrapper
    // Prevents heavy chart re-renders unless critical props change
    const MemoizedInnerWidget = React.memo(({
        component: Component,
        w, h, // Grid units
        width, height, // Pixels
        data,
        settings,
        globalFilters,
        editMode,
        onRemove,
        isLoading,
        error,
        isMock
    }: any) => {
        return <Component
            id={widget.i}
            data={data}
            settings={settings}
            globalFilters={globalFilters}
            w={w} h={h}
            width={width} height={height} // Pass pixel dims to chart (e.g. for canvas)
            editMode={editMode}
            onRemove={onRemove}
            isLoading={isLoading}
            error={error}
            isMock={isMock}
        />;
    }, (prev, next) => {
        // CUSTOM EQUALITY CHECK
        // 1. Dimensions Check (< 2px difference ignored)
        const isSameSize = Math.abs(prev.width - next.width) < 2 && Math.abs(prev.height - next.height) < 2;
        // 2. Data Check
        const isSameData = prev.data === next.data;
        // 3. Settings Check
        const isSameSettings = prev.settings === next.settings;

        return isSameSize && isSameData && isSameSettings;
    });

    return (
        <>
            {/* Edit Mode ID Badge */}
            {editMode && (
                <div className="absolute top-3 start-3 flex items-center gap-2 z-20 bg-surface/90 backdrop-blur p-1.5 rounded-lg border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold text-text-muted uppercase px-1">
                        {t('widgets.renderer.widget_id')}: {widget.i.split('-')[0]}
                    </span>
                </div>
            )}

            {/* Widget Content Container */}
            <div
                className="flex-1 w-full overflow-hidden min-h-0 relative h-full"
                // Although parent sets size via RGL, we ensure this container matches to be safe
                style={{ width: effectiveWidth || '100%', height: effectiveHeight || '100%' }}
            >
                <Suspense fallback={<WidgetSkeleton />}>
                    <WidgetErrorBoundary
                        widgetId={widget.i}
                        widgetType={widget.widget}
                        onError={logError}
                    >
                        {/* PERFORMANCE OPTIMIZATION: Render lightweight placeholder in Edit Mode */}
                        {editMode ? (
                            <WidgetWrapper
                                id={widget.i}
                                title={title}
                                isMock={isMock}
                                editMode={editMode}
                                onRemove={onDelete}
                                density={widget.h <= 2 ? 'compact' : 'default'}
                                icon={iconElement}
                                iconBgColor={manifest.meta.bgColor}
                            >
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 p-4 select-none animate-in fade-in duration-300">
                                    <div className="p-3 bg-slate-50/50 rounded-xl mb-1">
                                        {iconElement || <LayoutGrid className="w-6 h-6 opacity-50" />}
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                                        {manifest.meta.title}
                                    </span>
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                                        {widget.w}x{widget.h} • {t('common.edit_mode', 'Edit Mode')}
                                    </span>
                                </div>
                            </WidgetWrapper>
                        ) : manifest.dataSchema ? (
                            <WidgetWrapper
                                id={widget.i}
                                title={title}
                                isMock={isMock}
                                editMode={editMode}
                                onRemove={onDelete}
                                density={widget.h <= 2 ? 'compact' : 'default'}
                                icon={iconElement}
                                iconBgColor={manifest.meta.bgColor}
                                isLoading={loading}
                            >
                                <MemoizedInnerWidget
                                    component={manifest.component}
                                    w={widget.w} h={widget.h}
                                    width={effectiveWidth} height={effectiveHeight}
                                    data={data}
                                    settings={widget.settings}
                                    globalFilters={effectiveFilters}
                                    editMode={editMode}
                                    onRemove={onDelete}
                                    isLoading={loading}
                                    error={error}
                                    isMock={isMock}
                                />
                            </WidgetWrapper>
                        ) : (
                            // Legacy V1 Fallback
                            <manifest.component
                                id={widget.i}
                                w={widget.w}
                                h={widget.h}
                                editMode={editMode}
                                onRemove={onDelete}
                                productionLineId={productionLineId}
                                dataSourceId={dataSourceId}
                                settings={widget.settings}
                                globalFilters={effectiveFilters}
                            />
                        )}
                    </WidgetErrorBoundary>
                </Suspense>

                {/* Drag Overlay (Prevents Chart Interaction) */}
                {editMode && (
                    <div className="absolute inset-0 z-10 bg-transparent cursor-move" />
                )}
            </div>
        </>
    );
};

export default WidgetRenderer;

import React, { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react'; // Removed Maximize2, LayoutGrid, Move
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
import { MicroPreview } from './MicroPreview'; // Import the lightweight preview

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

    // 4. Normalize Filters
    const effectiveFilters: GlobalFilters = useMemo(() => ({
        dateRange: {
            start: contextFilters.dateRange?.start || new Date(),
            end: contextFilters.dateRange?.end || contextFilters.dateRange?.start || new Date()
        },
        shift: contextFilters.shift
    }), [contextFilters]);

    // 5. Data Fetching
    const { data, loading, error, isMock } = useWidgetData({
        dataId: manifest?.dataId,
        filters: effectiveFilters,
        settings: widget.settings,
        productionLineId,
        dataSourceId,
        schema: manifest?.dataSchema,
        refreshInterval: (widget.settings?.refreshRate || 0) * 1000
    });

    // 6. Data Transformation for MicroPreview (Row-based -> Column-based)
    // MicroPreview expects { key: [1, 2, 3] }, but API returns [{ key: 1 }, { key: 2 }]
    const previewData = useMemo(() => {
        if (!data || !Array.isArray(data) || data.length === 0) return {};

        const keys = Object.keys(data[0]);
        const result: Record<string, any[]> = {};

        keys.forEach(key => {
            result[key] = data.map(row => row[key]);
        });

        return result;
    }, [data]);

    // 7. Debounced Dimensions
    const parentWidth = width || 0;
    const parentHeight = height || 0;

    const { width: debouncedW, height: debouncedH } = useDebouncedDimensions(
        parentWidth,
        parentHeight,
        editMode ? 200 : 0
    );

    const effectiveWidth = editMode ? debouncedW : parentWidth;
    const effectiveHeight = editMode ? debouncedH : parentHeight;

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

    // 8. Loading State (Only for non-edit mode or initial load)
    if (loading && !data && manifest.dataId && !editMode) {
        return <WidgetSkeleton />;
    }

    // 9. Error State
    if (error && !editMode) {
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

    // 10. Locked State
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

    // 11. Memoized Inner Widget
    const MemoizedInnerWidget = React.memo(({ component: Component, ...props }: any) => {
        return <Component {...props} />;
    }, (prev, next) => {
        const isSameSize = Math.abs(prev.width - next.width) < 2 && Math.abs(prev.height - next.height) < 2;
        const isSameData = prev.data === next.data;
        const isSameSettings = prev.settings === next.settings;
        return isSameSize && isSameData && isSameSettings;
    });

    return (
        <>
            {/* Edit Mode ID Badge */}
            {editMode && (
                <div className="absolute top-3 start-3 flex items-center gap-2 z-20 bg-surface/90 backdrop-blur p-1.5 rounded-lg border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-[10px] font-bold text-text-muted uppercase px-1">
                        {t('widgets.renderer.widget_id')}: {widget.i.split('-')[0]}
                    </span>
                </div>
            )}

            {/* Widget Content Container */}
            <div
                className="flex-1 w-full overflow-hidden min-h-0 relative h-full"
                style={{ width: effectiveWidth || '100%', height: effectiveHeight || '100%' }}
            >
                <Suspense fallback={<WidgetSkeleton />}>
                    <WidgetErrorBoundary
                        widgetId={widget.i}
                        widgetType={widget.widget}
                        onError={logError}
                    >
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
                                {/* PERFORMANCE OPTIMIZATION: Render Lightweight MicroPreview */}
                                {/* We use the pivoted data if available, otherwise MicroPreview falls back to generic patterns */}
                                <div className="w-full h-full opacity-70 grayscale-[0.3] transition-all duration-300 group-hover:opacity-90 group-hover:grayscale-0">
                                    <MicroPreview
                                        widgetId={widget.widget}
                                        isSupported={true}
                                        sampleData={previewData}
                                    />
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

            </div>
        </>
    );
};

export default WidgetRenderer;

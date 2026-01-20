import React, { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
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

interface WidgetRendererProps {
    widget: ValidatedWidgetConfig;
    editMode: boolean;
    productionLineId?: string;
    dataSourceId?: string;
    globalFilters?: GlobalFilters; // Optional override
    onDelete?: () => void;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
    widget,
    editMode,
    productionLineId,
    dataSourceId,
    onDelete
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

    if (!manifest) {
        return (
            <div className="p-4 bg-error/10 border border-error/30 rounded text-error">
                {t('widgets.renderer.unknown_type')}: {widget.widget}
            </div>
        );
    }

    const Component = manifest.component;
    const title = widget.settings?.customTitle || manifest.meta.title;
    const IconComponent = useMemo(() => manifest.meta.icon ? getWidgetIcon(manifest.meta.icon) : undefined, [manifest.meta.icon]);
    const iconElement = useMemo(() => IconComponent ? <IconComponent className={manifest.meta.iconColor || "text-text-muted"} /> : undefined, [IconComponent, manifest.meta.iconColor]);

    // 6. Centralized Loading State (Initial Load Only)
    // Allows background refreshing for existing data
    if (loading && !data && manifest.dataId) {
        return <WidgetSkeleton />;
    }

    // 7. Centralized Error State
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

    // 8. Locked / Coming Soon State
    // We allow editing logic to bypass this if needed, but usually we want to see the lock even in edit mode
    // or maybe show a translucent version. For now, strictly locked.
    if (manifest.locked && !widget.settings?.unlockPreview) {
        return (
            <ComingSoonWidget
                {...{
                    id: widget.i,
                    w: widget.w,
                    h: widget.h,
                    settings: widget.settings,
                    demoData: false, // or use this to toggle "Internal Preview"
                    description: manifest.meta.description
                } as any}
            />
        );
    }

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

            {/* Widget Content */}
            <div className="flex-1 w-full overflow-hidden min-h-0 relative h-full">
                <Suspense fallback={<WidgetSkeleton />}>
                    <WidgetErrorBoundary
                        widgetId={widget.i}
                        widgetType={widget.widget}
                        onError={logError}
                    >
                        {manifest.dataSchema ? (
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
                                {/* Cast to any because TS doesn't know this specific component is V2-ready yet */}
                                <Component
                                    {...{
                                        id: widget.i,
                                        data,
                                        settings: widget.settings,
                                        globalFilters: effectiveFilters,
                                        w: widget.w,
                                        h: widget.h,
                                        editMode,
                                        onRemove: onDelete,
                                        isLoading: loading,
                                        error,
                                        isMock
                                    } as any}
                                />
                            </WidgetWrapper>
                        ) : (
                            // Legacy V1 Fallback
                            <Component
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

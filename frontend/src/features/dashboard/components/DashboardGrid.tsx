import React, { Suspense } from 'react';
import { WIDGET_REGISTRY, WIDGET_DEFINITIONS } from '../registry';
import WidgetSkeleton from './WidgetSkeleton';
import WidgetErrorBoundary from './WidgetErrorBoundary';
import { SIZE_TO_GRID } from '../config';

type WidgetType = string;

interface DashboardGridProps {
    widgets: WidgetType[];
    productionLineId?: string;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({ widgets, productionLineId }) => {
    // Industry standard: Use a 12-column base for maximum layout flexibility
    // grid-flow-dense allows widgets to pack into empty spaces
    return (
        <div className="grid grid-cols-12 grid-flow-dense gap-4 p-4">
            {widgets.map((widgetId) => {
                const WidgetComponent = WIDGET_REGISTRY[widgetId];
                const widgetDef = WIDGET_DEFINITIONS.find(d => d.id === widgetId);

                if (!WidgetComponent) return null;

                // Get default size from widget definition, fallback to small
                const defaultSize = widgetDef ? SIZE_TO_GRID[widgetDef.defaultSize] : SIZE_TO_GRID.small;

                // Map widget 'w' (1-4) to 12-column spans
                // w:1 -> 3 cols (quarter), w:2 -> 6 cols (half), w:3 -> 9 cols (3/4), w:4 -> 12 cols (full)
                const colSpanClass = {
                    1: 'col-span-12 md:col-span-6 lg:col-span-3',
                    2: 'col-span-12 md:col-span-12 lg:col-span-6',
                    3: 'col-span-12 md:col-span-12 lg:col-span-9',
                    4: 'col-span-12'
                }[defaultSize.w] || 'col-span-12 md:col-span-6 lg:col-span-3';

                const rowSpans: Record<number, string> = {
                    1: 'row-span-1',
                    2: 'row-span-2',
                    3: 'row-span-3',
                    4: 'row-span-4',
                };
                const rowClass = rowSpans[defaultSize.h] || 'row-span-1';

                return (
                    <div
                        key={widgetId}
                        className={`${colSpanClass} ${rowClass}`}
                    >
                        <WidgetErrorBoundary>
                            <Suspense fallback={<WidgetSkeleton />}>
                                <WidgetComponent
                                    w={defaultSize.w}
                                    h={defaultSize.h}
                                    productionLineId={productionLineId}
                                />
                            </Suspense>
                        </WidgetErrorBoundary>
                    </div>
                );
            })}
        </div>
    );
};

export default DashboardGrid;

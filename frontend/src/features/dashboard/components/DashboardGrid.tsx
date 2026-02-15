/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import { WIDGET_REGISTRY, WIDGET_DEFINITIONS } from '../registry';
import { WidgetSkeleton } from './WidgetSkeleton';
import WidgetErrorBoundary from './WidgetErrorBoundary';

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

                // Get default size from widget definition, fallback to small (1x1)
                const w = widgetDef?.defaultW || 1;
                const h = widgetDef?.defaultH || 1;

                // Map widget 'w' (1-4) to 12-column spans
                // w:1 -> 3 cols (quarter), w:2 -> 6 cols (half), w:3 -> 9 cols (3/4), w:4 -> 12 cols (full)
                // Note: This logic assumes 4-column grid logic (12/4=3).
                // If w is raw grid units (1-12), this might need adjustment, but based on registry, w is 3, 6, 12 etc.
                // Wait, registry says w:6, h:10.
                // If w=6 in a 12-col grid, that's half width.
                // So col-span should probably be just `col-span-${w}` if w is 1-12.
                // However, the original code had a mapping.
                // Let's look at the mapping again in the original file:
                // 1 -> col-span-12 md:col-span-6 lg:col-span-3 (Quarter layout)
                // This implies '1' meant '1 unit out of 4 columns'.
                // But w in registry is 6 (half), 3 (quarter), 12 (full).
                // So if w=6, it means col-span-6.
                // The previous code was `SIZE_TO_GRID[widgetDef.defaultSize]`.
                // Registry w is explicit grid columns (out of 12).

                // Actually, let's just trust w is out of 12.
                // If w=3, col-span-3.
                // Mobile: usually full width.
                // Tablet: maybe half?
                const actualColSpan = `col-span-12 md:col-span-${Math.min(12, Math.max(6, w))} lg:col-span-${w}`;

                const rowClass = `row-span-${h}`;

                return (
                    <div
                        key={widgetId}
                        className={`${actualColSpan} ${rowClass}`}
                    >
                        <WidgetErrorBoundary widgetId={widgetId} widgetType={widgetId}>
                            <Suspense fallback={<WidgetSkeleton />}>
                                <WidgetComponent
                                    w={w}
                                    h={h}
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

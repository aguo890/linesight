import React, { useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { ValidatedWidgetConfig } from '../services/WidgetService';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridLayoutProps {
    widgets: ValidatedWidgetConfig[];
    editMode: boolean;
    onLayoutChange: (layout: Layout[]) => void;
    renderWidget: (widget: ValidatedWidgetConfig) => React.ReactNode;
}

export const DashboardGridLayout: React.FC<DashboardGridLayoutProps> = ({
    widgets,
    editMode,
    onLayoutChange,
    renderWidget
}) => {
    // Memoize layouts to prevent infinite render loops with RGL
    // We only provide 'lg' so that RGL auto-calculates the changes for smaller breakpoints
    // based on the column counts (12 -> 10 -> 6 etc)
    const layouts = useMemo(() => ({
        lg: widgets.map(w => ({ ...w }))
    }), [widgets]);

    return (
        <div className="max-w-[1600px] mx-auto">
            {/* Force RGL styles for placeholder and resize handles */}
            <style>{`
                .react-grid-placeholder {
                    background: #ff4d4f !important; /* Red 500 */
                    opacity: 0.2 !important;
                    z-index: 1 !important;
                    border-radius: 16px;
                }
                .react-resizable-handle {
                    z-index: 50 !important;
                    background-image: none !important;
                    width: 20px !important;
                    height: 20px !important;
                    right: 4px !important;
                    bottom: 4px !important;
                }
                .react-resizable-handle::after {
                    content: "";
                    position: absolute;
                    right: 3px;
                    bottom: 3px;
                    width: 8px;
                    height: 8px;
                    border-right: 2px solid #94a3b8;
                    border-bottom: 2px solid #94a3b8;
                }
            `}</style>
            <ResponsiveGridLayout
                className={`layout ${!editMode ? 'transition-all duration-500' : ''}`}
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={25}
                compactType="vertical"
                preventCollision={false}
                isDraggable={editMode}
                isResizable={editMode}
                onLayoutChange={(_: any, allLayouts: any) => onLayoutChange(allLayouts.lg || [])}
                margin={[20, 20]}
                containerPadding={[0, 0]}
            >
                {widgets.map((widget) => (
                    <div key={widget.i} className={`
            bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] 
            overflow-hidden flex flex-col relative group border border-slate-100 transition-shadow hover:shadow-xl
            ${editMode ? 'cursor-move ring-2 ring-sky-500/50 scale-[0.99]' : ''}
          `}>
                        {renderWidget(widget)}
                    </div>
                ))}
            </ResponsiveGridLayout>
        </div>
    );
};

export default DashboardGridLayout;

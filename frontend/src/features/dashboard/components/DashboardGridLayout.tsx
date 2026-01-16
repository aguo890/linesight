import React, { useMemo, forwardRef } from 'react';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { ValidatedWidgetConfig } from '../services/WidgetService';

export interface DashboardGridLayoutProps {
    widgets: ValidatedWidgetConfig[];
    editMode: boolean;
    onLayoutChange: (layout: any[]) => void;
    renderWidget: (widget: ValidatedWidgetConfig) => React.ReactNode;
    isRTL?: boolean;
}

// WidgetWrapper to properly handle RGL prop injection
const WidgetWrapper = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { style?: React.CSSProperties }>(
    ({ style, className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                style={style}
                className={`${className} absolute top-0 left-0`}
                {...props}
            >
                {children}
            </div>
        );
    }
);
WidgetWrapper.displayName = 'WidgetWrapper';

export const DashboardGridLayout = ({
    widgets,
    editMode,
    onLayoutChange,
    renderWidget,
    isRTL = false
}: DashboardGridLayoutProps) => {
    const { width, containerRef, mounted } = useContainerWidth();

    // Memoize layouts to prevent infinite render loops with RGL
    // We only provide 'lg' so that RGL auto-calculates the changes for smaller breakpoints
    const layouts = useMemo(() => ({
        lg: widgets.map(w => ({ ...w }))
    }), [widgets]);

    return (
        <div ref={containerRef} dir={isRTL ? 'rtl' : 'ltr'} className="max-w-[1600px] mx-auto min-h-[500px]">
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

            {mounted ? (
                <Responsive
                    key={isRTL ? 'rtl' : 'ltr'}
                    className={`layout relative ${!editMode ? 'transition-all duration-500' : ''}`}
                    layouts={layouts}
                    width={width}
                    isRTL={isRTL}
                    resizeHandles={isRTL ? ['sw', 'se', 'nw'] : ['se', 'sw', 'ne']}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={25}
                    dragConfig={{ enabled: editMode }}
                    resizeConfig={{ enabled: editMode }}
                    onLayoutChange={(_, allLayouts) => onLayoutChange([...(allLayouts.lg || [])])}
                    margin={[20, 20]}
                    containerPadding={[0, 0]}
                >
                    {widgets.map((widget) => (
                        <WidgetWrapper
                            key={widget.i}
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={`
                bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] 
                overflow-hidden flex flex-col group border border-slate-100 transition-shadow hover:shadow-xl
                ${editMode ? 'cursor-move ring-2 ring-sky-500/50 scale-[0.99]' : ''}
              `}>
                            {renderWidget(widget)}
                        </WidgetWrapper>
                    ))}
                </Responsive>
            ) : (
                <div className="flex items-center justify-center p-12 text-slate-400">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 mb-4" />
                        <div className="h-4 w-32 bg-slate-100 rounded" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardGridLayout;

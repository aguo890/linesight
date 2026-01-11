import React, { useMemo } from 'react';
import { AlertTriangle, Layout } from 'lucide-react';
import { WIDGET_DEFINITIONS } from '../registry';
import { calculateSmartLayout } from '../../../utils/layoutUtils';

interface LayoutMiniMapProps {
    selectedWidgetIds: string[];
    maxRows?: number;
}

interface LayoutItem {
    id: string;
    w: number;
    h: number;
    x: number;
    y: number;
    category: string;
}

/**
 * Converts widget IDs to layout items using the shared smart packing algorithm.
 * Ensures the preview exactly matches what the wizard will generate.
 */
const getLayoutFromWidgetIds = (widgetIds: string[]): LayoutItem[] => {
    // Prepare items with dimensions
    const items = widgetIds.map(id => {
        const widget = WIDGET_DEFINITIONS.find(w => w.id === id);
        if (!widget) return null;

        return {
            id,
            w: widget.defaultW,
            h: widget.defaultH,
            category: widget.category
        };
    }).filter(Boolean) as Array<{ id: string; w: number; h: number; category: string }>;

    // Run same smart packing algorithm used by wizard
    const packedLayout = calculateSmartLayout(items);

    return packedLayout.map(item => ({
        id: item.id,
        w: item.w,
        h: item.h,
        x: item.x,
        y: item.y,
        category: item.category
    }));
};

const CATEGORY_COLORS: Record<string, string> = {
    Efficiency: 'bg-blue-400/40 border-blue-500/30',
    Quality: 'bg-purple-400/40 border-purple-500/30',
    Workforce: 'bg-amber-400/40 border-amber-500/30',
    Operations: 'bg-slate-400/40 border-slate-500/30',
};

export const LayoutMiniMap: React.FC<LayoutMiniMapProps> = ({
    selectedWidgetIds,
    maxRows: _maxRows = 24
}) => {
    const layout = useMemo(() => getLayoutFromWidgetIds(selectedWidgetIds), [selectedWidgetIds]);

    const { totalRows, density } = useMemo(() => {
        if (layout.length === 0) return { totalRows: 0, density: 'empty' as const };

        const maxY = Math.max(...layout.map((item: LayoutItem) => item.y + item.h));

        // Density calculation (screen heights, assuming ~16 rows per screen)
        if (maxY <= 16) return { totalRows: maxY, density: 'light' as const };
        if (maxY <= 32) return { totalRows: maxY, density: 'normal' as const };
        return { totalRows: maxY, density: 'heavy' as const };
    }, [layout]);

    const densityStatus = {
        empty: { label: 'Empty', color: 'text-text-muted', bg: 'bg-surface-subtle' },
        light: { label: 'Compact', color: 'text-success', bg: 'bg-success/10' },
        normal: { label: 'Balanced', color: 'text-brand', bg: 'bg-brand/10' },
        heavy: { label: 'Heavy', color: 'text-warning', bg: 'bg-warning/10' },
    };

    const status = densityStatus[density];

    return (
        <div className="w-full bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-2.5 py-1.5 bg-surface-subtle border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Layout className="w-3 h-3 text-text-muted" />
                        <span className="text-[9px] uppercase font-bold text-text-muted tracking-wide">
                            Spatial Preview
                        </span>
                    </div>
                    {selectedWidgetIds.length > 0 && (
                        <span className={`text-[8px] font-semibold px-1 rounded border border-current/10 ${status.bg} ${status.color}`}>
                            {status.label}
                        </span>
                    )}
                </div>
            </div>

            {/* Grid Preview */}
            <div className="p-1.5">
                {selectedWidgetIds.length === 0 ? (
                    <div className="h-24 flex items-center justify-center text-[10px] text-text-muted italic text-center px-4">
                        Select widgets to preview layout
                    </div>
                ) : (
                    <div className="relative bg-surface-subtle rounded border border-border p-0.5 overflow-hidden" style={{ height: '140px' }}>
                        {/* 12-column grid lines */}
                        <div className="absolute inset-0 grid grid-cols-12 gap-px opacity-30 pointer-events-none">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="bg-border" />
                            ))}
                        </div>

                        {/* Widget blocks */}
                        <div
                            className="relative grid grid-cols-12 gap-px auto-rows-[5px]"
                            style={{
                                minHeight: '100%',
                                maxHeight: '100%',
                                overflowY: 'auto',
                            }}
                        >
                            {layout.map((item: LayoutItem, index: number) => (
                                <div
                                    key={item.id}
                                    className={`
                                        ${CATEGORY_COLORS[item.category] || 'bg-text-muted/40 border-text-muted/30'}
                                        border rounded-sm transition-all duration-300 ease-out
                                        animate-in fade-in zoom-in-95
                                    `}
                                    style={{
                                        gridColumn: `${item.x + 1} / span ${item.w}`,
                                        gridRow: `${item.y + 1} / span ${item.h}`,
                                        animationDelay: `${index * 50}ms`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            {selectedWidgetIds.length > 0 && (
                <div className="px-3 py-2 bg-surface-subtle border-t border-border">
                    <div className="flex items-center justify-between text-[10px]">
                        <span className="text-text-muted">
                            {selectedWidgetIds.length} widget{selectedWidgetIds.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-text-muted/70">
                            ~{Math.ceil(totalRows / 16)} screen{Math.ceil(totalRows / 16) !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Heavy warning */}
                    {density === 'heavy' && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-warning font-medium">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Dashboard may require scrolling</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

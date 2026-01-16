import React, { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layout } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { WIDGET_DEFINITIONS } from '../registry';
import { calculateSmartLayout } from '../../../utils/layoutUtils';

// --- 1. Helpers for Icons & Tooltips ---

// Helper: Safe Icon Lookup
const resolveIcon = (iconName: string | undefined) => {
    if (!iconName) return LucideIcons.Box;
    // @ts-ignore - Dynamic access to Lucide icons
    const IconComponent = LucideIcons[iconName];
    return IconComponent || LucideIcons.Box; // Fallback
};

// Component: Lightweight Portal Tooltip (No external lib)
const SimpleTooltip = ({ children, content }: { children: React.ReactNode, content: React.ReactNode }) => {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Position tooltip above the element, centered
            setCoords({
                top: rect.top - 8, // 8px offset
                left: rect.left + rect.width / 2
            });
            setVisible(true);
        }
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setVisible(false)}
                className="w-full h-full"
            >
                {children}
            </div>
            {visible && createPortal(
                <div
                    className="fixed z-[9999] px-2 py-1 text-[10px] font-medium text-white bg-slate-900 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full whitespace-nowrap"
                    style={{ top: coords.top, left: coords.left }}
                >
                    {content}
                    {/* Tiny CSS Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>,
                document.body
            )}
        </>
    );
};

// --- 2. Main Component Logic ---

interface LayoutMiniMapProps {
    selectedWidgetIds: string[];
    maxRows?: number;
}

interface LayoutItemWithMeta {
    id: string;
    w: number;
    h: number;
    x: number;
    y: number;
    category: string;
    titleKey: string;
    iconName: string;
}

/**
 * Converts widget IDs to layout items using the shared smart packing algorithm.
 * Ensures the preview exactly matches what the wizard will generate.
 */
const getLayoutFromWidgetIds = (widgetIds: string[]): LayoutItemWithMeta[] => {
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

    return packedLayout.map(item => {
        const widgetDef = WIDGET_DEFINITIONS.find(w => w.id === item.id);
        return {
            id: item.id,
            w: item.w,
            h: item.h,
            x: item.x,
            y: item.y,
            category: item.category,
            titleKey: widgetDef?.title || 'Unknown Widget',
            iconName: widgetDef?.icon || 'Box'
        };
    });
};

const CATEGORY_COLORS: Record<string, string> = {
    Efficiency: 'bg-blue-400',
    Quality: 'bg-purple-400',
    Workforce: 'bg-amber-400',
    Operations: 'bg-slate-400',
};

export const LayoutMiniMap: React.FC<LayoutMiniMapProps> = ({
    selectedWidgetIds,
    maxRows: _maxRows = 24
}) => {
    const { t } = useTranslation();
    const layout = useMemo(() => getLayoutFromWidgetIds(selectedWidgetIds), [selectedWidgetIds]);

    const { totalRows, density } = useMemo(() => {
        if (layout.length === 0) return { totalRows: 0, density: 'empty' as const };

        const maxY = Math.max(...layout.map((item: LayoutItemWithMeta) => item.y + item.h));

        // Density calculation (screen heights, assuming ~16 rows per screen)
        if (maxY <= 16) return { totalRows: maxY, density: 'light' as const };
        if (maxY <= 32) return { totalRows: maxY, density: 'normal' as const };
        return { totalRows: maxY, density: 'heavy' as const };
    }, [layout]);

    const densityStatus = {
        empty: { label: t('wizard.mini_map.density.empty'), color: 'text-text-muted', bg: 'bg-surface-subtle' },
        light: { label: t('wizard.mini_map.density.compact'), color: 'text-success', bg: 'bg-success/10' },
        normal: { label: t('wizard.mini_map.density.balanced'), color: 'text-brand', bg: 'bg-brand/10' },
        heavy: { label: t('wizard.mini_map.density.heavy'), color: 'text-warning', bg: 'bg-warning/10' },
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
                            {t('wizard.mini_map.title')}
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
                        {t('wizard.mini_map.empty_state')}
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
                            {layout.map((item: LayoutItemWithMeta, index: number) => {
                                const Icon = resolveIcon(item.iconName);

                                // LOGIC: Size Thresholds (assuming rowHeight ~5px)
                                // Large: > 20px height (approx 4 rows)
                                const isLarge = item.h >= 4;
                                // Medium: > 10px height (approx 2 rows)
                                const isMedium = !isLarge && item.h >= 2;

                                // STYLE: Blueprint Aesthetic
                                // Use category colors but with low opacity for the background
                                // and higher opacity for the border.
                                const baseColor = CATEGORY_COLORS[item.category] || 'bg-slate-200';

                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            gridColumn: `${item.x + 1} / span ${item.w}`,
                                            gridRow: `${item.y + 1} / span ${item.h}`,
                                            animationDelay: `${index * 50}ms`,
                                        }}
                                        className={`
                                            relative rounded-sm border 
                                            ${baseColor.replace('bg-', 'bg-opacity-20 border-opacity-40 border-')} 
                                            transition-colors hover:bg-opacity-30
                                            animate-in fade-in zoom-in-95
                                            cursor-default
                                        `}
                                    >
                                        <SimpleTooltip content={<>{t(item.titleKey as any)} <span className="opacity-50 ml-1">({item.w}x{item.h})</span></>}>
                                            <div className="w-full h-full flex items-center justify-center overflow-hidden">

                                                {/* VISUAL: Icon for Large Items */}
                                                {isLarge && (
                                                    <Icon
                                                        strokeWidth={1.5}
                                                        className="w-3 h-3 text-current opacity-50"
                                                    />
                                                )}

                                                {/* VISUAL: Dot for Medium Items */}
                                                {isMedium && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-30" />
                                                )}

                                                {/* Small items remain just colored blocks */}
                                            </div>
                                        </SimpleTooltip>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            {selectedWidgetIds.length > 0 && (
                <div className="px-3 py-2 bg-surface-subtle border-t border-border">
                    <div className="flex items-center justify-between text-[10px]">
                        <span className="text-text-muted">
                            {t('wizard.mini_map.stats.widgets', { count: selectedWidgetIds.length })}
                        </span>
                        <span className="text-text-muted/70">
                            {t('wizard.mini_map.stats.screens', { count: Math.ceil(totalRows / 16) })}
                        </span>
                    </div>

                    {/* Heavy warning */}
                    {density === 'heavy' && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-warning font-medium">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{t('wizard.mini_map.scroll_warning')}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

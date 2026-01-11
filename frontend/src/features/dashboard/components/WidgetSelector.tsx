import React, { useState, useMemo } from 'react';
import { Check, Plus, Lock, AlertCircle, Sparkles, CheckCircle, CheckSquare } from 'lucide-react';
import { WIDGET_DEFINITIONS, getCompatibilityStatus, type WidgetCategory, type CompatibilityStatus } from '../registry';
import { MicroPreview, type SampleDataMap } from './MicroPreview';

interface WidgetSelectorProps {
    /** List of columns currently available in the data source */
    availableFields: string[];
    /** Callback when a widget is selected/toggled */
    onSelect: (widgetId: string) => void;
    /** Callback to set all selected widgets at once */
    onSelectMany?: (widgetIds: string[]) => void;
    /** Currently selected widgets (optional, for multi-select scenarios like Wizard) */
    selectedWidgets?: string[];
    /** Whether to use the simplified 'Add' view (sidebar) or detailed 'Toggle' view (wizard) */
    variant?: 'sidebar' | 'wizard';
    /** Sample data for micro-previews (optional) */
    sampleData?: SampleDataMap;
}

const CATEGORY_ORDER: WidgetCategory[] = ['Efficiency', 'Quality', 'Workforce', 'Operations'];

const CATEGORY_COLORS: Record<WidgetCategory, { bg: string; text: string; border: string }> = {
    Efficiency: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
    Quality: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
    Workforce: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
    Operations: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' },
};

export const WidgetSelector: React.FC<WidgetSelectorProps> = ({
    availableFields,
    onSelect,
    onSelectMany,
    selectedWidgets = [],
    variant = 'sidebar',
    sampleData = {}
}) => {
    const [activeCategory, setActiveCategory] = useState<WidgetCategory>('Efficiency');

    // Process all widgets with compatibility status
    const processedWidgets = useMemo(() => {
        return WIDGET_DEFINITIONS.map(widget => {
            const compatibility = getCompatibilityStatus(widget.id, availableFields);
            return {
                ...widget,
                compatibility,
                isSupported: compatibility.status === 'supported',
                isNearMiss: compatibility.status === 'near-miss',
                locked: widget.locked
            };
        });
    }, [availableFields]);

    // Group widgets by category
    const widgetsByCategory = useMemo(() => {
        return CATEGORY_ORDER.reduce((acc, cat) => {
            acc[cat] = processedWidgets
                .filter(w => w.category === cat)
                .sort((a, b) => {
                    // Sort: supported first, then by priority
                    if (a.isSupported && !b.isSupported) return -1;
                    if (!a.isSupported && b.isSupported) return 1;
                    // Sort locked widgets at the end of their category
                    if (a.locked && !b.locked) return 1;
                    if (!a.locked && b.locked) return -1;
                    return (b.priority || 0) - (a.priority || 0);
                });
            return acc;
        }, {} as Record<WidgetCategory, typeof processedWidgets>);
    }, [processedWidgets]);

    // Get all supported widget IDs (genuinely implemented ones)
    const allSupportedIds = useMemo(() =>
        processedWidgets.filter(w => w.isSupported).map(w => w.id),
        [processedWidgets]
    );

    const aiRecommendedIds = useMemo(() =>
        processedWidgets
            .filter(w => w.isSupported && w.tags.includes('essential'))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .map(w => w.id),
        [processedWidgets]
    );

    // Count supported widgets per category
    const categoryCounts = useMemo(() => {
        return CATEGORY_ORDER.reduce((acc, cat) => {
            const widgets = widgetsByCategory[cat] || [];
            acc[cat] = {
                total: widgets.length,
                supported: widgets.filter(w => w.isSupported).length,
            };
            return acc;
        }, {} as Record<WidgetCategory, { total: number; supported: number }>);
    }, [widgetsByCategory]);

    const handleSelectAll = () => {
        if (onSelectMany) {
            onSelectMany(allSupportedIds);
        }
    };

    const handleSelectAI = () => {
        if (onSelectMany) {
            onSelectMany(aiRecommendedIds);
        }
    };

    // For sidebar variant, use the original flat layout
    if (variant === 'sidebar') {
        return (
            <div className="flex flex-col gap-3">
                {processedWidgets
                    .sort((a, b) => {
                        if (a.isSupported && !b.isSupported) return -1;
                        if (!a.isSupported && b.isSupported) return 1;
                        return 0;
                    })
                    .map((widget, index) => (
                        <WidgetCard
                            key={widget.id}
                            widget={{
                                ...widget,
                                priority: widget.priority || 0
                            }}
                            isSelected={selectedWidgets.includes(widget.id)}
                            onSelect={onSelect}
                            variant="sidebar"
                            sampleData={sampleData}
                            index={index}
                        />
                    ))
                }
            </div>
        );
    }

    // Wizard variant: Tabbed marketplace layout
    const currentWidgets = widgetsByCategory[activeCategory] || [];

    return (
        <div className="flex flex-col">
            {/* Action Bar */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSelectAI}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand bg-brand/10 border border-brand/20 rounded-lg hover:bg-brand/20 transition-colors"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Recommendations
                    </button>
                    <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-main bg-surface-subtle border border-border rounded-lg hover:bg-surface transition-colors"
                    >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Select All Compatible
                    </button>
                </div>
                <div className="text-xs text-text-muted">
                    {selectedWidgets.length} selected • {allSupportedIds.length} compatible
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 mb-4 p-1 bg-surface-subtle border border-border rounded-lg">
                {CATEGORY_ORDER.map(cat => {
                    const counts = categoryCounts[cat];
                    const isActive = activeCategory === cat;
                    const colors = CATEGORY_COLORS[cat];

                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`
                                flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all
                                ${isActive
                                    ? `${colors.bg} ${colors.text} shadow-sm border ${colors.border}`
                                    : 'text-text-muted hover:text-text-main hover:bg-surface/50'
                                }
                            `}
                        >
                            <span>{cat}</span>
                            <span className={`ml-1.5 ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                                ({counts.supported}/{counts.total})
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Widget Grid */}
            <div className="mt-2">
                <div className="grid grid-cols-2 gap-3">
                    {currentWidgets.map((widget, index) => (
                        <WidgetCard
                            key={widget.id}
                            widget={{
                                ...widget,
                                priority: widget.priority || 0
                            }}
                            isSelected={selectedWidgets.includes(widget.id)}
                            onSelect={onSelect}
                            variant="wizard"
                            sampleData={sampleData}
                            index={index}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Filter available sample data to only include fields relevant to the specific widget.
 */
const getWidgetSampleData = (
    widget: { requiredRawColumns?: string[]; requiredComputedMetrics?: string[] },
    sampleData: SampleDataMap
): SampleDataMap => {
    // If no sample data at all, return empty
    if (!sampleData || Object.keys(sampleData).length === 0) return {};

    const rawReqs = widget.requiredRawColumns || [];
    const computedReqs = widget.requiredComputedMetrics || [];
    const allNeededFields = [...rawReqs, ...computedReqs];

    // If no specific requirements are listed, or common fields are missing,
    // we provide a set of "Common denominator" fields that MicroPreview can use for fallbacks.
    const commonFields = ['actual_qty', 'planned_qty', 'dhu', 'operators_present', 'efficiency'];

    const result: SampleDataMap = {};
    const fieldsToExtract = allNeededFields.length > 0 ? [...allNeededFields, ...commonFields] : Object.keys(sampleData);

    fieldsToExtract.forEach(field => {
        if (sampleData[field]) {
            result[field] = sampleData[field];
        }
    });

    return result;
};

// Extracted WidgetCard component for cleaner code
interface WidgetCardProps {
    widget: {
        id: string;
        title: string;
        description: string;
        category: WidgetCategory;
        tags: string[];
        priority: number;
        requiredRawColumns?: string[];
        requiredComputedMetrics?: string[];
        compatibility: CompatibilityStatus;
        isSupported: boolean;
        isNearMiss: boolean;
        locked?: boolean;
    };
    isSelected: boolean;
    onSelect: (widgetId: string) => void;
    variant: 'sidebar' | 'wizard';
    sampleData?: SampleDataMap;
    index: number;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
    widget,
    isSelected,
    onSelect,
    variant,
    sampleData = {},
    index
}) => {
    const { isSupported, isNearMiss } = widget;
    const isAdded = variant === 'sidebar' && isSelected;

    const showStatusColors = variant === 'sidebar' || isSelected || !isSupported;

    const borderClass = isAdded
        ? 'border-success/30 bg-success/10 opacity-60 cursor-default'
        : showStatusColors
            ? (isSupported
                ? 'border-success/30 bg-success/10 hover:border-success/50 cursor-pointer shadow-sm'
                : isNearMiss
                    ? 'border-warning/30 bg-warning/5 hover:border-warning/50 cursor-pointer'
                    : widget.locked
                        ? 'border-brand-secondary/30 bg-brand-secondary/10 opacity-75 cursor-not-allowed'
                        : 'border-border bg-surface-subtle opacity-70 cursor-not-allowed')
            : 'border-border hover:border-text-muted hover:bg-surface-subtle cursor-pointer';

    const handleClick = () => {
        if (isAdded || widget.locked) return;
        // Allow selection if supported OR if already selected (to allow deselection)
        if (isSupported || isSelected) {
            onSelect(widget.id);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`
                relative p-4 border rounded-xl transition-all flex flex-col justify-between group overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500
                ${variant === 'sidebar' ? 'min-h-0' : 'min-h-[220px]'}
                ${borderClass}
                ${isSelected && variant === 'wizard' ? 'ring-1 ring-offset-0' : ''}
                ${isSelected && variant === 'wizard' ? (isSupported ? 'ring-green-300' : 'ring-amber-300') : ''}
            `}
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
        >
            {/* Disabled Stripes Overlay */}
            {
                !isSupported && !isNearMiss && (
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.02)_10px,rgba(0,0,0,0.02)_20px)] pointer-events-none" />
                )
            }

            {/* Header Section */}
            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`
                        w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                        ${isSupported
                            ? 'bg-success/20 text-success'
                            : isNearMiss
                                ? 'bg-warning/20 text-warning'
                                : widget.locked
                                    ? 'bg-brand-secondary/20 text-brand-secondary'
                                    : 'bg-surface-subtle text-text-muted'
                        }
                    `}>
                        {widget.locked ? (
                            <Lock className="w-5 h-5 transition-transform group-hover:scale-110" />
                        ) : !isSupported && !isNearMiss ? (
                            <AlertCircle className="w-5 h-5" />
                        ) : (
                            <div className="w-5 h-5 flex items-center justify-center font-bold text-lg">
                                {widget.title.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate pr-2 text-text-main">
                            {widget.title}
                        </p>
                        <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                            {widget.description}
                        </p>
                    </div>
                </div>

                {/* Action Icon */}
                <div className="flex-shrink-0 ml-2">
                    {variant === 'sidebar' ? (
                        <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center transition-all
                            ${isAdded
                                ? 'bg-success/20 text-success'
                                : (isSupported
                                    ? 'bg-surface-subtle text-text-muted group-hover:bg-success group-hover:text-white group-hover:shadow-md'
                                    : widget.locked
                                        ? 'bg-brand-secondary/20 text-brand-secondary'
                                        : 'bg-surface-subtle text-text-muted cursor-not-allowed')
                            }
                        `}>
                            {isAdded ? <Check className="w-4 h-4" /> : (isSupported ? <Plus className="w-4 h-4" /> : <Lock className="w-3 h-3" />)}
                        </div>
                    ) : (
                        widget.locked ? (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 shadow-sm">
                                <Lock className="w-3.5 h-3.5" />
                            </div>
                        ) : isSelected ? (
                            <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-white
                            ${isSupported ? 'bg-success' : 'bg-warning'}
                        `}>
                                <Check className="w-3.5 h-3.5" />
                            </div>
                        ) : (
                            <div className={`
                            w-6 h-6 border-2 rounded-full group-hover:border-text-muted
                            ${isSupported ? 'border-border' : 'border-border bg-surface-subtle'}
                        `} />
                        )
                    )}
                </div>
            </div>

            {/* Visualization Slot */}
            <div className="relative h-24 mt-4 mb-3 flex items-center justify-center overflow-hidden">
                {isSupported ? (
                    <div className="w-full h-full relative group/chart">
                        <MicroPreview
                            widgetId={widget.id}
                            sampleData={getWidgetSampleData(widget, sampleData)}
                            isSupported={isSupported}
                        />
                        {/* Simulated Data Badge */}
                        <div className="absolute top-0 right-0 opacity-0 group-hover/chart:opacity-100 transition-opacity">
                            <span className="text-[7px] text-text-muted font-bold uppercase bg-surface/90 px-1 py-0.5 rounded border border-border tracking-tighter shadow-sm whitespace-nowrap">
                                <span className="inline-block w-1 h-1 bg-success rounded-full animate-pulse mr-1" />
                                Simulated Data
                            </span>
                        </div>
                    </div>
                ) : (
                    /* Ghost Wireframe Fallback */
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-40 select-none pointer-events-none">
                        <div className="w-24 h-1 bg-border rounded-full mb-1.5 animate-pulse" />
                        <div className="w-16 h-1 bg-surface-subtle rounded-full mb-2 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="text-[8px] text-text-muted font-bold uppercase tracking-widest leading-none">
                            {widget.locked ? 'Coming Soon' : 'Data Req.'}
                        </span>
                    </div>
                )}
            </div>

            {/* Status Section */}
            <div className="relative z-10 pt-1 border-t border-border/50">
                <div className="mt-1 flex flex-wrap gap-1.5 min-h-[1.5rem] items-center">
                    {widget.locked ? (
                        <div className="flex items-center gap-1 text-[10px] text-brand-secondary font-medium italic">
                            <span>Future Capability</span>
                        </div>
                    ) : isSupported ? (
                        <div className="flex items-center gap-1 text-[10px] text-success font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>Ready to Use</span>
                        </div>
                    ) : isNearMiss ? (
                        <div className="flex items-center gap-1 text-[10px] text-warning font-medium bg-warning/10 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-3 h-3" />
                            <span>Near Match</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-[10px] text-text-muted font-medium">
                            <AlertCircle className="w-3 h-3" />
                            <span>Needs Mapping</span>
                        </div>
                    )}
                </div>
                {isSupported && widget.tags.includes('essential') && (
                    <div className="flex items-center gap-1 text-[10px] text-brand font-medium">
                        <Sparkles className="w-3 h-3" />
                        <span>Recommended</span>
                    </div>
                )}
                {widget.locked && (
                    <div className="flex items-center gap-1 text-[10px] text-brand-secondary font-semibold bg-brand-secondary/10 px-2 py-1 rounded border border-brand-secondary/20 uppercase tracking-tight">
                        <Lock className="w-3 h-3" />
                        <span>Coming Soon</span>
                    </div>
                )}
            </div>
        </div >
    );
};

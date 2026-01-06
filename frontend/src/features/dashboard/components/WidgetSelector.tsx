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
    Efficiency: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    Quality: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    Workforce: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    Operations: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
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
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSelectAI}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Recommendations
                    </button>
                    <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Select All Compatible
                    </button>
                </div>
                <div className="text-xs text-gray-500">
                    {selectedWidgets.length} selected • {allSupportedIds.length} compatible
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg">
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
                                    ? `${colors.bg} ${colors.text} shadow-sm`
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
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
        ? 'border-green-200 bg-green-50 opacity-60 cursor-default'
        : showStatusColors
            ? (isSupported
                ? 'border-green-200 bg-green-50/50 hover:border-green-300 cursor-pointer'
                : isNearMiss
                    ? 'border-amber-200 bg-amber-50/30 hover:border-amber-300 cursor-pointer'
                    : widget.locked
                        ? 'border-purple-200 bg-purple-50/40 opacity-75 cursor-not-allowed'
                        : 'border-gray-200 bg-gray-100 opacity-70 cursor-not-allowed')
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer';

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
                            ? 'bg-green-100 text-green-700'
                            : isNearMiss
                                ? 'bg-amber-100 text-amber-700'
                                : widget.locked
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-200 text-gray-500'
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
                        <p className="text-sm font-semibold leading-tight truncate pr-2 text-gray-900">
                            {widget.title}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
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
                                ? 'bg-green-100 text-green-600'
                                : (isSupported
                                    ? 'bg-gray-100 text-gray-500 group-hover:bg-green-600 group-hover:text-white group-hover:shadow-md'
                                    : widget.locked
                                        ? 'bg-purple-100 text-purple-600'
                                        : 'bg-gray-100 text-gray-300 cursor-not-allowed')
                            }
                        `}>
                            {isAdded ? <Check className="w-4 h-4" /> : (isSupported ? <Plus className="w-4 h-4" /> : <Lock className="w-3 h-3" />)}
                        </div>
                    ) : (
                        widget.locked ? (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-100 text-purple-600 border border-purple-200 shadow-sm">
                                <Lock className="w-3.5 h-3.5" />
                            </div>
                        ) : isSelected ? (
                            <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-white
                            ${isSupported ? 'bg-green-600' : 'bg-amber-500'}
                        `}>
                                <Check className="w-3.5 h-3.5" />
                            </div>
                        ) : (
                            <div className={`
                            w-6 h-6 border-2 rounded-full group-hover:border-gray-300
                            ${isSupported ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}
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
                            <span className="text-[7px] text-gray-400 font-bold uppercase bg-white/90 px-1 py-0.5 rounded border border-gray-100 tracking-tighter shadow-sm whitespace-nowrap">
                                <span className="inline-block w-1 h-1 bg-green-500 rounded-full animate-pulse mr-1" />
                                Simulated Data
                            </span>
                        </div>
                    </div>
                ) : (
                    /* Ghost Wireframe Fallback */
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-40 select-none pointer-events-none">
                        <div className="w-24 h-1 bg-gray-200 rounded-full mb-1.5 animate-pulse" />
                        <div className="w-16 h-1 bg-gray-100 rounded-full mb-2 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                            {widget.locked ? 'Coming Soon' : 'Data Req.'}
                        </span>
                    </div>
                )}
            </div>

            {/* Status Section */}
            <div className="relative z-10 pt-1 border-t border-gray-50/50">
                <div className="mt-1 flex flex-wrap gap-1.5 min-h-[1.5rem] items-center">
                    {widget.locked ? (
                        <div className="flex items-center gap-1 text-[10px] text-purple-600 font-medium italic">
                            <span>Future Capability</span>
                        </div>
                    ) : isSupported ? (
                        <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>Ready to Use</span>
                        </div>
                    ) : isNearMiss ? (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-3 h-3" />
                            <span>Near Match</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            <span>Needs Mapping</span>
                        </div>
                    )}
                </div>
                {isSupported && widget.tags.includes('essential') && (
                    <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                        <Sparkles className="w-3 h-3" />
                        <span>Recommended</span>
                    </div>
                )}
                {widget.locked && (
                    <div className="flex items-center gap-1 text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-1 rounded border border-purple-100 uppercase tracking-tight">
                        <Lock className="w-3 h-3" />
                        <span>Coming Soon</span>
                    </div>
                )}
            </div>
        </div >
    );
};

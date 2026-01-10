import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    CheckCircle,
    AlertTriangle,
    AlertCircle,
    ArrowRight,
    ArrowLeft,
    EyeOff,
    Zap,
    Search,
    Sparkles,
    HelpCircle,
    ChevronDown,
    Check,
    FileText,
    Database,
    Pencil,
    Filter
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ColumnMapping {
    source_column: string;
    target_field: string | null;
    confidence: number;
    tier: 'hash' | 'fuzzy' | 'llm' | 'unmatched' | 'manual';
    fuzzy_score?: number;
    reasoning?: string;
    sample_data: any[];
    needs_review: boolean;
    ignored: boolean;
    status: 'auto_mapped' | 'needs_review' | 'needs_attention';
}

interface AvailableField {
    field: string;
    description: string;
}

interface WizardStep2MappingProps {
    mappings: ColumnMapping[];
    availableFields: AvailableField[];
    onMappingValidated: (mappings: ColumnMapping[]) => Promise<void>;
    onBack: () => void;
    filename?: string;
    onAnimationComplete?: () => void;
}

// ============================================================================
// Design System: Status Configuration (Single Source of Truth)
// ============================================================================

type TierType = 'hash' | 'fuzzy' | 'llm' | 'unmatched' | 'manual';

const STATUS_CONFIG: Record<TierType, {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    accentColor: string;
    label: string;
    tooltip: string;
}> = {
    hash: {
        icon: Zap,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        accentColor: 'border-l-purple-500',
        label: 'Exact',
        tooltip: 'Exact column name match'
    },
    fuzzy: {
        icon: Search,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        accentColor: 'border-l-blue-500',
        label: 'Fuzzy',
        tooltip: 'Similar name matched'
    },
    llm: {
        icon: Sparkles,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        accentColor: 'border-l-indigo-500',
        label: 'AI',
        tooltip: 'AI-suggested mapping'
    },
    manual: {
        icon: Pencil,
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        accentColor: 'border-l-gray-400',
        label: 'Manual',
        tooltip: 'Manually assigned'
    },
    unmatched: {
        icon: HelpCircle,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        accentColor: 'border-l-transparent',
        label: 'Unset',
        tooltip: 'Needs mapping'
    }
};

// ============================================================================
// Filter Types
// ============================================================================

type FilterType = 'all' | 'unmapped' | 'conflicts';

// ============================================================================
// COMPONENT: AI Processing View
// ============================================================================

const AIProcessingView: React.FC<{
    mappings: ColumnMapping[];
    processAction: () => Promise<void>;
    onAnimationComplete?: () => void;
}> = ({ mappings, processAction, onAnimationComplete }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasStartedRef = useRef(false);
    const processActionRef = useRef(processAction);
    const onCompleteRef = useRef(onAnimationComplete);

    processActionRef.current = processAction;
    onCompleteRef.current = onAnimationComplete;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;

        let isMounted = true;

        const addLog = (msg: string) => {
            if (!isMounted) return;
            setLogs(prev => [...prev, msg]);
        };

        const runSimulation = async () => {
            addLog("Initializing transformation engine...");
            setProgress(5);
            await new Promise(r => setTimeout(r, 400));
            if (!isMounted) return;

            addLog("Verifying schema compatibility...");
            setProgress(15);

            const maxDetailedLogs = 3;
            const columnsToLog = mappings.slice(0, maxDetailedLogs);

            for (let i = 0; i < columnsToLog.length; i++) {
                if (!isMounted) return;
                const m = columnsToLog[i];
                addLog(`Mapping column '${m.source_column}'...`);
                setProgress(prev => Math.min(prev + 10, 50));
                await new Promise(r => setTimeout(r, 150));
            }
            if (!isMounted) return;

            addLog("Processing ingestion request...");
            setProgress(60);

            try {
                addLog("Sending data to LineSight Core...");
                const startTime = Date.now();

                await processActionRef.current();

                if (!isMounted) return;

                const elapsed = Date.now() - startTime;
                if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000 - elapsed));

                setProgress(100);
                addLog("Ingestion successful. Finalizing...");
                await new Promise(r => setTimeout(r, 600));

                if (isMounted && onCompleteRef.current) {
                    onCompleteRef.current();
                }
            } catch (error: any) {
                if (!isMounted) return;
                console.error("Ingestion Error:", error);
                const errorMessage = error?.message || error?.toString() || "Unknown error";
                addLog(`Error: ${errorMessage}`);
            }
        };

        runSimulation();
        return () => {
            isMounted = false;
            hasStartedRef.current = false;
        };
    }, []);

    return (
        <div className="flex flex-col h-full items-center justify-center py-12 px-4 animate-in fade-in duration-500 bg-white">
            <div className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-center gap-8 mb-8 relative">
                    <div className="relative z-10 bg-white p-4 rounded-xl shadow-md border border-gray-100">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-0.5 bg-gray-100">
                        <div className="absolute inset-0 bg-blue-500 w-1/3 animate-[shimmer_1.5s_infinite]" />
                    </div>
                    <div className="relative z-10 bg-white p-4 rounded-xl shadow-md border border-blue-100">
                        <Database className="w-8 h-8 text-blue-600" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    </div>
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900">Processing Data</h3>
                    <p className="text-sm text-gray-500">Validating and importing to production line...</p>
                </div>

                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div
                    ref={scrollRef}
                    className="h-48 bg-gray-50 rounded-lg border border-gray-200 p-4 overflow-y-auto font-mono text-xs space-y-1.5 shadow-inner"
                >
                    {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-gray-600 animate-in slide-in-from-bottom-2 duration-300">
                            <span className="text-blue-500 mt-0.5">❯</span>
                            <span>{log}</span>
                        </div>
                    ))}
                    <div className="animate-pulse text-blue-500 ml-3">_</div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Sub-Components
// ============================================================================

// Unified Status Indicator (Icon + Percentage)
const StatusIndicator: React.FC<{
    tier: TierType;
    confidence: number;
    reasoning?: string;
}> = ({ tier, confidence, reasoning }) => {
    const config = STATUS_CONFIG[tier];
    const Icon = config.icon;
    const [showTooltip, setShowTooltip] = useState(false);

    const tooltipText = reasoning || `${config.tooltip} (${Math.round((confidence ?? 0) * 100)}% confidence)`;

    return (
        <div
            className="relative flex items-center gap-1.5 cursor-help"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgColor} ${config.borderColor} border`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                <span className={`text-xs font-medium ${config.color}`}>
                    {Math.round((confidence ?? 0) * 100)}%
                </span>
            </div>

            {/* Tooltip */}
            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                    <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs whitespace-normal">
                        <div className="font-medium mb-0.5">{config.label} Match</div>
                        <div className="text-gray-300">{tooltipText}</div>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-900" />
                    </div>
                </div>
            )}
        </div>
    );
};

// Data Preview Pills
const DataPreview: React.FC<{ samples: any[] }> = ({ samples }) => {
    if (!samples || samples.length === 0) {
        return <span className="text-xs text-gray-400 italic">No preview</span>;
    }

    return (
        <div className="flex items-center gap-1 mt-1">
            <span
                className="inline-block text-[11px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded max-w-[80px] truncate"
                title={String(samples[0])}
            >
                {String(samples[0]).substring(0, 12)}
                {String(samples[0]).length > 12 && '…'}
            </span>
            {samples.length > 1 && (
                <span className="text-[10px] text-gray-400">+{samples.length - 1}</span>
            )}
        </div>
    );
};

// Helper: Highlight search term in text
const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) return <>{text}</>;

    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} className="font-semibold text-blue-700 bg-blue-100 rounded px-0.5">
                        {part}
                    </span>
                ) : (
                    part
                )
            )}
        </>
    );
};

// Premium Field Selector (Stacked Layout + Accent Bar)
const FieldSelector: React.FC<{
    value: string | null;
    tier: TierType;
    options: AvailableField[];
    onChange: (field: string) => void;
    onIgnore: () => void;
    isIgnored: boolean;
    usedFields: Map<string, string>;
    suggestedFields?: AvailableField[];
}> = ({ value, tier, options, onChange, onIgnore, isIgnored, usedFields, suggestedFields = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        const searchLower = search.toLowerCase();
        return options.filter(
            opt => opt.field.toLowerCase().includes(searchLower) ||
                opt.description.toLowerCase().includes(searchLower)
        );
    }, [options, search]);

    // Separate suggested vs all fields
    const suggestedSet = useMemo(() => new Set(suggestedFields.map(f => f.field)), [suggestedFields]);

    const { suggested, allFields } = useMemo(() => {
        const suggested: AvailableField[] = [];
        const allFields: AvailableField[] = [];

        filteredOptions.forEach(opt => {
            if (suggestedSet.has(opt.field)) {
                suggested.push(opt);
            } else {
                allFields.push(opt);
            }
        });

        return { suggested, allFields: allFields.sort((a, b) => a.field.localeCompare(b.field)) };
    }, [filteredOptions, suggestedSet]);

    const selectedOption = options.find(opt => opt.field === value);
    const config = STATUS_CONFIG[tier];

    React.useLayoutEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const styles: React.CSSProperties = {
                position: 'fixed',
                width: `${Math.max(rect.width, 320)}px`,
                left: `${rect.left}px`,
                zIndex: 9999,
            };
            if (spaceBelow < 300) {
                styles.bottom = `${window.innerHeight - rect.top + 4}px`;
                styles.maxHeight = '340px';
            } else {
                styles.top = `${rect.bottom + 4}px`;
                styles.maxHeight = '340px';
            }
            setDropdownStyle(styles);
        }
    }, [isOpen]);

    // Ignored state
    if (isIgnored) {
        return (
            <button
                onClick={onIgnore}
                className="flex items-center gap-2 text-sm text-gray-400 italic hover:text-gray-600 transition-colors h-14 px-3 w-full rounded-lg border border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            >
                <EyeOff className="w-4 h-4" />
                <span>Ignored — click to restore</span>
            </button>
        );
    }

    // Unmapped state (ghost/dashed)
    const isUnmapped = !value;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative w-full flex flex-col justify-center px-3 py-2 text-sm rounded-lg
                    transition-all duration-150 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50
                    border-l-[3px] min-h-[56px]
                    ${isUnmapped
                        ? 'border border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-100/50 hover:border-gray-400 border-l-transparent'
                        : `border border-gray-200 bg-white hover:border-blue-400 shadow-sm hover:shadow ${config.accentColor}`
                    }
                `}
            >
                {selectedOption ? (
                    <>
                        <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-gray-900 truncate">{selectedOption.field}</span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {selectedOption.description && (
                            <span className="text-xs text-gray-500 line-clamp-1 text-left mt-0.5">
                                {selectedOption.description}
                            </span>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-between w-full">
                        <span className="text-gray-400">Select target field...</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[9990]" onClick={() => setIsOpen(false)} />
                    <div style={dropdownStyle} className="fixed bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b shrink-0 bg-gray-50/80">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search fields..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto min-h-0 flex-1">
                            {/* Suggested Section */}
                            {suggested.length > 0 && (
                                <>
                                    <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100">
                                        <span className="text-xs font-medium text-indigo-600 flex items-center gap-1.5">
                                            <Sparkles className="w-3 h-3" />
                                            Suggested
                                        </span>
                                    </div>
                                    {suggested.map((opt) => {
                                        const usedByColumn = usedFields.get(opt.field);
                                        const isUsedElsewhere = usedByColumn && opt.field !== value;
                                        return (
                                            <FieldOption
                                                key={opt.field}
                                                field={opt}
                                                isSelected={opt.field === value}
                                                isUsed={!!isUsedElsewhere}
                                                searchTerm={search}
                                                onClick={() => {
                                                    onChange(opt.field);
                                                    setIsOpen(false);
                                                    setSearch('');
                                                }}
                                            />
                                        );
                                    })}
                                </>
                            )}

                            {/* All Fields Section */}
                            {allFields.length > 0 && (
                                <>
                                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                        <span className="text-xs font-medium text-gray-500">All Fields</span>
                                    </div>
                                    {allFields.map((opt) => {
                                        const usedByColumn = usedFields.get(opt.field);
                                        const isUsedElsewhere = usedByColumn && opt.field !== value;
                                        return (
                                            <FieldOption
                                                key={opt.field}
                                                field={opt}
                                                isSelected={opt.field === value}
                                                isUsed={!!isUsedElsewhere}
                                                searchTerm={search}
                                                onClick={() => {
                                                    onChange(opt.field);
                                                    setIsOpen(false);
                                                    setSearch('');
                                                }}
                                            />
                                        );
                                    })}
                                </>
                            )}

                            {filteredOptions.length === 0 && (
                                <div className="px-3 py-6 text-sm text-gray-400 text-center">
                                    No fields match "{search}"
                                </div>
                            )}
                        </div>

                        {/* Ignore Action */}
                        <div className="p-2 border-t bg-gray-50">
                            <button
                                onClick={() => { onIgnore(); setIsOpen(false); }}
                                className="w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <EyeOff className="w-4 h-4" />
                                Ignore this column
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Field Option (used in dropdown)
const FieldOption: React.FC<{
    field: AvailableField;
    isSelected: boolean;
    isUsed: boolean;
    searchTerm: string;
    onClick: () => void;
}> = ({ field, isSelected, isUsed, searchTerm, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`
                w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50 flex flex-col gap-0.5
                transition-colors duration-100
                ${isSelected ? 'bg-blue-50' : ''}
                ${isUsed ? 'opacity-60' : ''}
            `}
        >
            <div className="flex items-center justify-between">
                <span className={`font-medium ${isUsed ? 'text-gray-500' : 'text-gray-900'}`}>
                    <HighlightText text={field.field} highlight={searchTerm} />
                </span>
                <div className="flex items-center gap-2">
                    {isUsed && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                            in use
                        </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                </div>
            </div>
            {field.description && (
                <span className="text-xs text-gray-500 line-clamp-1">
                    <HighlightText text={field.description} highlight={searchTerm} />
                </span>
            )}
        </button>
    );
};

// Filter Pills
const FilterPills: React.FC<{
    activeFilter: FilterType;
    onFilterChange: (filter: FilterType) => void;
    counts: { all: number; unmapped: number; conflicts: number };
}> = ({ activeFilter, onFilterChange, counts }) => {
    const pills: { key: FilterType; label: string; count: number; color: string }[] = [
        { key: 'all', label: 'All', count: counts.all, color: 'gray' },
        { key: 'unmapped', label: 'Unmapped', count: counts.unmapped, color: 'amber' },
        { key: 'conflicts', label: 'Conflicts', count: counts.conflicts, color: 'red' },
    ];

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            {pills.map(pill => {
                const isActive = activeFilter === pill.key;
                return (
                    <button
                        key={pill.key}
                        onClick={() => onFilterChange(pill.key)}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md
                            transition-all duration-150
                            ${isActive
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }
                        `}
                    >
                        <span>{pill.label}</span>
                        <span className={`
                            text-xs px-1.5 py-0.5 rounded-full
                            ${isActive
                                ? pill.count > 0 && pill.key !== 'all'
                                    ? pill.key === 'conflicts' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                : 'bg-gray-200/50 text-gray-500'
                            }
                        `}>
                            {pill.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

// Mapping Row
const MappingRow: React.FC<{
    mapping: ColumnMapping;
    availableFields: AvailableField[];
    onUpdate: (updates: Partial<ColumnMapping>) => void;
    index: number;
    usedFields: Map<string, string>;
    isConflicted?: boolean;
    conflictingColumns?: string[];
    suggestedFields?: AvailableField[];
}> = ({ mapping, availableFields, onUpdate, index, usedFields, isConflicted, conflictingColumns, suggestedFields }) => {
    const handleFieldChange = (field: string) => {
        onUpdate({
            target_field: field,
            tier: 'manual' as const,
            confidence: 1.0,
            needs_review: false,
        });
    };

    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`
                grid grid-cols-12 gap-4 px-4 py-3 border-b
                transition-all duration-150 ease-in-out items-center
                ${mapping.ignored ? 'opacity-50 bg-gray-50/50 border-gray-100' : ''}
                ${isConflicted ? 'bg-amber-50/80 border-amber-200' : 'border-gray-100 hover:bg-gray-50/80'}
            `}
            style={{ animationDelay: `${index * 30}ms` }}
            title={isConflicted ? `Conflict: Also mapped by ${conflictingColumns?.filter(c => c !== mapping.source_column).join(', ')}` : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Source Column */}
            <div className="col-span-4 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 truncate">
                        {mapping.source_column}
                    </span>
                </div>
                <DataPreview samples={mapping.sample_data} />
            </div>

            {/* Connector Arrow */}
            <div className="col-span-1 flex items-center justify-center">
                <ArrowRight className={`
                    w-4 h-4 transition-all duration-200
                    ${isHovered ? 'text-blue-400 scale-110' : 'text-gray-300'}
                `} />
            </div>

            {/* Target Field Selector */}
            <div className="col-span-4 min-w-0">
                <FieldSelector
                    value={mapping.target_field}
                    tier={mapping.tier}
                    options={availableFields}
                    onChange={handleFieldChange}
                    onIgnore={() => onUpdate({ ignored: !mapping.ignored })}
                    isIgnored={mapping.ignored}
                    usedFields={usedFields}
                    suggestedFields={suggestedFields}
                />
            </div>

            {/* Status */}
            <div className="col-span-3 flex items-center justify-end gap-2 min-w-0">
                {isConflicted && !mapping.ignored && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Duplicate</span>
                    </div>
                )}
                {!mapping.ignored && !isConflicted && mapping.target_field && (
                    <StatusIndicator
                        tier={mapping.tier}
                        confidence={mapping.confidence}
                        reasoning={mapping.reasoning}
                    />
                )}
                {!mapping.ignored && !mapping.target_field && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Unset</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const WizardStep2Mapping: React.FC<WizardStep2MappingProps> = ({
    mappings: initialMappings,
    availableFields,
    onMappingValidated,
    onBack,
    filename,
    onAnimationComplete
}) => {
    const [mappings, setMappings] = useState<ColumnMapping[]>(initialMappings || []);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    const memoizedProcessAction = useCallback(() => {
        return onMappingValidated(mappings);
    }, [onMappingValidated, mappings]);

    // Stats & Filter Counts
    const { stats, filterCounts } = useMemo(() => {
        if (!mappings || mappings.length === 0) {
            return {
                stats: { autoMapped: 0, needsReview: 0, needsAttention: 0, ignored: 0 },
                filterCounts: { all: 0, unmapped: 0, conflicts: 0 }
            };
        }

        const stats = {
            autoMapped: mappings.filter(m => !m.ignored && m.status === 'auto_mapped').length,
            needsReview: mappings.filter(m => !m.ignored && m.status === 'needs_review').length,
            needsAttention: mappings.filter(m => !m.ignored && m.status === 'needs_attention').length,
            ignored: mappings.filter(m => m.ignored).length,
        };

        return {
            stats,
            filterCounts: {
                all: mappings.length,
                unmapped: mappings.filter(m => !m.ignored && !m.target_field).length,
                conflicts: 0 // Will be calculated below
            }
        };
    }, [mappings]);

    const handleUpdateMapping = (index: number, updates: Partial<ColumnMapping>) => {
        setMappings(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
    };

    const handleValidate = () => {
        setIsProcessing(true);
    };

    // Duplicate Detection
    const { conflictsMap, usedFields, hasConflicts } = useMemo(() => {
        const targetToSources = new Map<string, string[]>();
        const used = new Map<string, string>();

        mappings.forEach(m => {
            if (!m.ignored && m.target_field) {
                const sources = targetToSources.get(m.target_field) || [];
                sources.push(m.source_column);
                targetToSources.set(m.target_field, sources);
                if (!used.has(m.target_field)) {
                    used.set(m.target_field, m.source_column);
                }
            }
        });

        const conflicts = new Map<string, string[]>();
        targetToSources.forEach((sources, target) => {
            if (sources.length > 1) {
                conflicts.set(target, sources);
            }
        });

        return {
            conflictsMap: conflicts,
            usedFields: used,
            hasConflicts: conflicts.size > 0
        };
    }, [mappings]);

    // Update conflict count
    const updatedFilterCounts = useMemo(() => ({
        ...filterCounts,
        conflicts: conflictsMap.size
    }), [filterCounts, conflictsMap.size]);

    // Filter mappings
    const filteredMappings = useMemo(() => {
        switch (activeFilter) {
            case 'unmapped':
                return mappings.filter(m => !m.ignored && !m.target_field);
            case 'conflicts':
                return mappings.filter(m => {
                    if (m.ignored || !m.target_field) return false;
                    return conflictsMap.has(m.target_field);
                });
            default:
                return mappings;
        }
    }, [mappings, activeFilter, conflictsMap]);

    const hasUnmappedRequired = mappings.some(
        m => !m.ignored && !m.target_field && m.status === 'needs_attention'
    );

    const cannotConfirm = hasConflicts || hasUnmappedRequired;

    if (isProcessing) {
        return (
            <div className="flex flex-col h-full -mx-6 -my-6">
                <AIProcessingView
                    mappings={mappings}
                    processAction={memoizedProcessAction}
                    onAnimationComplete={onAnimationComplete}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full -mx-6 -my-6">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 px-6 py-6">
                {/* Header */}
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">Validate Mapping</h3>
                        <p className="text-sm text-gray-500 mt-1">Review how your columns match the database.</p>
                    </div>
                    {filename && <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">{filename}</span>}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Auto-mapped', count: stats.autoMapped, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
                        { label: 'Need Review', count: stats.needsReview, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
                        { label: 'Attention', count: stats.needsAttention, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
                        { label: 'Ignored', count: stats.ignored, color: 'text-gray-600', bg: 'bg-gray-100', icon: EyeOff },
                    ].map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.label} className={`${stat.bg} rounded-xl p-4 flex items-center gap-3 border border-transparent hover:border-black/5 transition-colors`}>
                                <Icon className={`w-5 h-5 ${stat.color}`} />
                                <div>
                                    <span className={`text-2xl font-bold ${stat.color}`}>{stat.count}</span>
                                    <span className="text-xs font-medium text-gray-600 ml-1.5">{stat.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center justify-between mb-4">
                    <FilterPills
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        counts={updatedFilterCounts}
                    />
                    <div className="text-sm text-gray-500">
                        Showing {filteredMappings.length} of {mappings.length} columns
                    </div>
                </div>

                {/* Mapping Table */}
                <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden mb-2">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50/80 border-b border-gray-200">
                        <div className="col-span-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Source Column
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Target Field
                        </div>
                        <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                            Status
                        </div>
                    </div>

                    {/* Mapping Rows */}
                    <div className="divide-y divide-gray-100">
                        {filteredMappings.length === 0 ? (
                            <div className="px-4 py-12 text-center text-gray-500">
                                <Filter className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p className="font-medium">No columns match this filter</p>
                                <p className="text-sm mt-1">Try selecting a different view</p>
                            </div>
                        ) : (
                            filteredMappings.map((mapping, index) => {
                                const isConflicted = !mapping.ignored && mapping.target_field
                                    ? conflictsMap.has(mapping.target_field)
                                    : false;
                                const conflictingColumns = mapping.target_field
                                    ? conflictsMap.get(mapping.target_field)
                                    : undefined;

                                // Find original index for update handler
                                const originalIndex = mappings.findIndex(m => m.source_column === mapping.source_column);

                                return (
                                    <MappingRow
                                        key={mapping.source_column}
                                        mapping={mapping}
                                        availableFields={availableFields}
                                        onUpdate={(updates) => handleUpdateMapping(originalIndex, updates)}
                                        index={index}
                                        usedFields={usedFields}
                                        isConflicted={isConflicted}
                                        conflictingColumns={conflictingColumns}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="bg-white border-t border-gray-200 pt-4 px-6">
                <div className="flex justify-between items-center">
                    {/* Left: Back Button */}
                    <button
                        onClick={onBack}
                        className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </button>

                    {/* Right: Actions & Alerts */}
                    <div className="flex items-center gap-4">
                        {hasConflicts && (
                            <span className="text-sm text-amber-600 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                {conflictsMap.size} field{conflictsMap.size > 1 ? 's have' : ' has'} duplicate mappings
                            </span>
                        )}
                        {hasUnmappedRequired && !hasConflicts && (
                            <span className="text-sm text-red-600 flex items-center gap-1.5 animate-pulse">
                                <AlertCircle className="w-4 h-4" />
                                Remaining fields needed
                            </span>
                        )}

                        <button
                            onClick={handleValidate}
                            disabled={cannotConfirm}
                            className={`
                                flex items-center px-6 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm
                                transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                                ${cannotConfirm
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]'
                                }
                            `}
                        >
                            Confirm Mapping
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WizardStep2Mapping;

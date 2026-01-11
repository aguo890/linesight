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
import { useTranslation } from 'react-i18next';

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
    labelKey: string;
    tooltipKey: string;
}> = {
    hash: {
        icon: Zap,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        borderColor: 'border-purple-200 dark:border-purple-800',
        accentColor: 'border-l-purple-500',
        labelKey: 'wizard.step2.status_labels.exact',
        tooltipKey: 'wizard.step2.status_labels.exact_tooltip'
    },
    fuzzy: {
        icon: Search,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        accentColor: 'border-l-blue-500',
        labelKey: 'wizard.step2.status_labels.fuzzy',
        tooltipKey: 'wizard.step2.status_labels.fuzzy_tooltip'
    },
    llm: {
        icon: Sparkles,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
        borderColor: 'border-indigo-200 dark:border-indigo-800',
        accentColor: 'border-l-indigo-500',
        labelKey: 'wizard.step2.status_labels.ai',
        tooltipKey: 'wizard.step2.status_labels.ai_tooltip'
    },
    manual: {
        icon: Pencil,
        color: 'text-text-muted',
        bgColor: 'bg-surface-subtle',
        borderColor: 'border-border',
        accentColor: 'border-l-border',
        labelKey: 'wizard.step2.status_labels.manual',
        tooltipKey: 'wizard.step2.status_labels.manual_tooltip'
    },
    unmatched: {
        icon: HelpCircle,
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        borderColor: 'border-amber-200 dark:border-amber-800',
        accentColor: 'border-l-transparent',
        labelKey: 'wizard.step2.status_labels.unset',
        tooltipKey: 'wizard.step2.status_labels.unset_tooltip'
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
    const { t } = useTranslation();
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
            addLog(t('wizard.step2.processing.logs.init'));
            setProgress(5);
            await new Promise(r => setTimeout(r, 400));
            if (!isMounted) return;

            addLog(t('wizard.step2.processing.logs.schema'));
            setProgress(15);

            const maxDetailedLogs = 3;
            const columnsToLog = mappings.slice(0, maxDetailedLogs);

            for (let i = 0; i < columnsToLog.length; i++) {
                if (!isMounted) return;
                const m = columnsToLog[i];
                addLog(t('wizard.step2.processing.logs.mapping', { column: m.source_column }));
                setProgress(prev => Math.min(prev + 10, 50));
                await new Promise(r => setTimeout(r, 150));
            }
            if (!isMounted) return;

            addLog(t('wizard.step2.processing.logs.req'));
            setProgress(60);

            try {
                addLog(t('wizard.step2.processing.logs.sending'));
                const startTime = Date.now();

                await processActionRef.current();

                if (!isMounted) return;

                const elapsed = Date.now() - startTime;
                if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000 - elapsed));

                setProgress(100);
                addLog(t('wizard.step2.processing.logs.success'));
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
        <div className="flex flex-col h-full items-center justify-center py-12 px-4 animate-in fade-in duration-500 bg-surface">
            <div className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-center gap-8 mb-8 relative">
                    <div className="relative z-10 bg-surface p-4 rounded-xl shadow-md border border-border">
                        <FileText className="w-8 h-8 text-text-muted" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-0.5 bg-border">
                        <div className="absolute inset-0 bg-brand w-1/3 animate-[shimmer_1.5s_infinite]" />
                    </div>
                    <div className="relative z-10 bg-surface p-4 rounded-xl shadow-md border border-brand/30">
                        <Database className="w-8 h-8 text-brand" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    </div>
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-text-main">{t('wizard.step2.processing.title')}</h3>
                    <p className="text-sm text-text-muted">{t('wizard.step2.processing.subtitle')}</p>
                </div>

                <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                        className="h-full bg-brand transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div
                    ref={scrollRef}
                    className="h-48 bg-surface-subtle rounded-lg border border-border p-4 overflow-y-auto font-mono text-xs space-y-1.5 shadow-inner"
                >
                    {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-text-muted animate-in slide-in-from-bottom-2 duration-300">
                            <span className="text-brand mt-0.5">❯</span>
                            <span>{log}</span>
                        </div>
                    ))}
                    <div className="animate-pulse text-brand ml-3">_</div>
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
    const { t } = useTranslation();
    const config = STATUS_CONFIG[tier];
    const Icon = config.icon;
    const [showTooltip, setShowTooltip] = useState(false);

    const tooltipText = reasoning || `${t(config.tooltipKey as any)} (${Math.round((confidence ?? 0) * 100)}% confidence)`;

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
                    <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs whitespace-normal">
                        <div className="font-medium mb-0.5">{t(config.labelKey as any)} Match</div>
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
        return <span className="text-xs text-text-muted italic">No preview</span>;
    }

    return (
        <div className="flex items-center gap-1 mt-1">
            <span
                className="inline-block text-[11px] font-mono bg-surface-subtle text-text-muted px-1.5 py-0.5 rounded max-w-[80px] truncate border border-border"
                title={String(samples[0])}
            >
                {String(samples[0]).substring(0, 12)}
                {String(samples[0]).length > 12 && '…'}
            </span>
            {samples.length > 1 && (
                <span className="text-[10px] text-text-muted">+{samples.length - 1}</span>
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
                    <span key={i} className="font-semibold text-brand bg-brand/10 rounded px-0.5">
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
    const { t } = useTranslation();
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
                className="flex items-center gap-2 text-sm text-text-muted italic hover:text-text-main transition-colors h-14 px-3 w-full rounded-lg border border-dashed border-border hover:border-border hover:bg-surface-subtle"
            >
                <EyeOff className="w-4 h-4" />
                <span>{t('wizard.step2.field_selector.restore_action')}</span>
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
                    focus:outline-none focus:ring-2 focus:ring-brand/50
                    border-l-[3px] min-h-[56px]
                    ${isUnmapped
                        ? 'border border-dashed border-border bg-surface-subtle/50 hover:bg-surface-subtle hover:border-border border-l-transparent'
                        : `border border-border bg-surface hover:border-brand/50 shadow-sm hover:shadow ${config.accentColor}`
                    }
                `}
            >
                {selectedOption ? (
                    <>
                        <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-text-main truncate">{selectedOption.field}</span>
                            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {selectedOption.description && (
                            <span className="text-xs text-text-muted line-clamp-1 text-left mt-0.5">
                                {selectedOption.description}
                            </span>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-between w-full">
                        <span className="text-text-muted">{t('wizard.step2.field_selector.select_placeholder')}</span>
                        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[9990]" onClick={() => setIsOpen(false)} />
                    <div style={dropdownStyle} className="fixed bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b border-border shrink-0 bg-surface-subtle/80">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                <input
                                    type="text"
                                    placeholder={t('wizard.step2.field_selector.search_placeholder')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto min-h-0 flex-1">
                            {/* Suggested Section */}
                            {suggested.length > 0 && (
                                <>
                                    <div className="px-3 py-2 bg-brand/5 border-b border-brand/10">
                                        <span className="text-xs font-medium text-brand flex items-center gap-1.5">
                                            <Sparkles className="w-3 h-3" />
                                            {t('wizard.step2.field_selector.suggested')}
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
                                    <div className="px-3 py-2 bg-surface-subtle border-b border-border">
                                        <span className="text-xs font-medium text-text-muted">{t('wizard.step2.field_selector.all_fields')}</span>
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
                                <div className="px-3 py-6 text-sm text-text-muted text-center">
                                    {t('wizard.step2.field_selector.no_results', { term: search })}
                                </div>
                            )}
                        </div>

                        {/* Ignore Action */}
                        <div className="p-2 border-t border-border bg-surface-subtle">
                            <button
                                onClick={() => { onIgnore(); setIsOpen(false); }}
                                className="w-full px-3 py-2 text-sm text-text-muted hover:bg-surface rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <EyeOff className="w-4 h-4" />
                                {t('wizard.step2.field_selector.ignore_action')}
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
    const { t } = useTranslation();
    return (
        <button
            onClick={onClick}
            className={`
                w-full px-3 py-2.5 text-left text-sm hover:bg-brand/5 flex flex-col gap-0.5
                transition-colors duration-100
                ${isSelected ? 'bg-brand/5' : ''}
                ${isUsed ? 'opacity-60' : ''}
            `}
        >
            <div className="flex items-center justify-between">
                <span className={`font-medium ${isUsed ? 'text-text-muted' : 'text-text-main'}`}>
                    <HighlightText text={field.field} highlight={searchTerm} />
                </span>
                <div className="flex items-center gap-2">
                    {isUsed && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                            {t('wizard.step2.field_selector.in_use')}
                        </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-brand" />}
                </div>
            </div>
            {field.description && (
                <span className="text-xs text-text-muted line-clamp-1">
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
    const { t } = useTranslation();
    const pills: { key: FilterType; label: string; count: number; color: string }[] = [
        { key: 'all', label: t('wizard.step2.filter.all'), count: counts.all, color: 'gray' },
        { key: 'unmapped', label: t('wizard.step2.filter.unmapped'), count: counts.unmapped, color: 'amber' },
        { key: 'conflicts', label: t('wizard.step2.filter.conflicts'), count: counts.conflicts, color: 'red' },
    ];

    return (
        <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-lg">
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
                                ? 'bg-surface text-text-main shadow-sm'
                                : 'text-text-muted hover:text-text-main hover:bg-surface/50'
                            }
                        `}
                    >
                        <span>{pill.label}</span>
                        <span className={`
                            text-xs px-1.5 py-0.5 rounded-full
                            ${isActive
                                ? pill.count > 0 && pill.key !== 'all'
                                    ? pill.key === 'conflicts' ? 'bg-status-danger-subtle text-status-danger' : 'bg-status-warning-subtle text-status-warning'
                                    : 'bg-surface-subtle text-text-muted'
                                : 'bg-border/50 text-text-muted'
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
    const { t } = useTranslation();
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
                ${mapping.ignored ? 'opacity-50 bg-surface-subtle/50 border-border' : ''}
                ${isConflicted ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'border-border hover:bg-surface-subtle/80'}
            `}
            style={{ animationDelay: `${index * 30}ms` }}
            title={isConflicted ? `Conflict: Also mapped by ${conflictingColumns?.filter(c => c !== mapping.source_column).join(', ')}` : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Source Column */}
            <div className="col-span-4 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-main truncate">
                        {mapping.source_column}
                    </span>
                </div>
                <DataPreview samples={mapping.sample_data} />
            </div>

            {/* Connector Arrow */}
            <div className="col-span-1 flex items-center justify-center">
                <ArrowRight className={`
                    w-4 h-4 transition-all duration-200
                    ${isHovered ? 'text-brand scale-110' : 'text-border'}
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
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{t('wizard.step2.status_labels.duplicate')}</span>
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
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{t('wizard.step2.status_labels.unset')}</span>
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
    const { t } = useTranslation();
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
            <div className="flex-1 overflow-y-auto bg-surface-subtle/50 px-6 py-6">
                {/* Header */}
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h3 className="text-xl font-semibold text-text-main">{t('wizard.step2.title')}</h3>
                        <p className="text-sm text-text-muted mt-1">{t('wizard.step2.subtitle')}</p>
                    </div>
                    {filename && <span className="text-xs px-2 py-1 bg-surface-subtle rounded text-text-muted font-mono">{filename}</span>}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { label: t('wizard.step2.stats.auto'), count: stats.autoMapped, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
                        { label: t('wizard.step2.stats.review'), count: stats.needsReview, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
                        { label: t('wizard.step2.stats.attention'), count: stats.needsAttention, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
                        { label: t('wizard.step2.stats.ignored'), count: stats.ignored, color: 'text-gray-600', bg: 'bg-gray-100', icon: EyeOff },
                    ].map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.label} className={`${stat.bg} rounded-xl p-4 flex items-center gap-3 border border-transparent hover:border-black/5 dark:hover:border-white/5 transition-colors`}>
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
                    <div className="text-sm text-text-muted">
                        {t('wizard.step2.showing_count', { filtered: filteredMappings.length, total: mappings.length })}
                    </div>
                </div>

                {/* Mapping Table */}
                <div className="border border-border rounded-xl bg-surface shadow-sm overflow-hidden mb-2">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface-subtle/80 border-b border-border">
                        <div className="col-span-4 text-xs font-semibold text-text-muted uppercase tracking-wide">
                            {t('wizard.step2.table.source')}
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-4 text-xs font-semibold text-text-muted uppercase tracking-wide">
                            {t('wizard.step2.table.target')}
                        </div>
                        <div className="col-span-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">
                            {t('wizard.step2.table.status')}
                        </div>
                    </div>

                    {/* Mapping Rows */}
                    <div className="divide-y divide-border">
                        {filteredMappings.length === 0 ? (
                            <div className="px-4 py-12 text-center text-text-muted">
                                <Filter className="w-8 h-8 mx-auto mb-2 text-border" />
                                <p className="font-medium">{t('wizard.step2.table.no_match')}</p>
                                <p className="text-sm mt-1">{t('wizard.step2.table.try_different')}</p>
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
            <div className="bg-surface border-t border-border pt-4 px-6">
                <div className="flex justify-between items-center">
                    {/* Left: Back Button */}
                    <button
                        onClick={onBack}
                        className="flex items-center px-4 py-2.5 text-sm font-medium text-text-muted bg-surface border border-border rounded-lg hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand/20 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('common.back')}
                    </button>

                    {/* Right: Actions & Alerts */}
                    <div className="flex items-center gap-4">
                        {hasConflicts && (
                            <span className="text-sm text-amber-600 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                {t('wizard.step2.alerts.conflict_count', { count: conflictsMap.size })}
                            </span>
                        )}
                        {hasUnmappedRequired && !hasConflicts && (
                            <span className="text-sm text-red-600 flex items-center gap-1.5 animate-pulse">
                                <AlertCircle className="w-4 h-4" />
                                {t('wizard.step2.alerts.remaining_needed')}
                            </span>
                        )}

                        <button
                            onClick={handleValidate}
                            disabled={cannotConfirm}
                            className={`
                                flex items-center px-6 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm
                                transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand/50
                                ${cannotConfirm
                                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                    : 'bg-brand hover:bg-brand-dark hover:shadow-md active:scale-[0.98]'
                                }
                            `}
                        >
                            {t('wizard.step2.btn_confirm')}
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WizardStep2Mapping;

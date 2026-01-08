import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, Layout, Factory, ChevronRight, Settings, AlertCircle, Loader2 } from 'lucide-react';
// Note: useNavigate and canManageInfrastructure removed - no longer navigating to add line from wizard
import { WizardStep1Upload } from './wizard/WizardStep1Upload';
import { WizardStep2Mapping } from './wizard/WizardStep2Mapping';
import { WizardStep3Widgets } from './wizard/WizardStep3Widgets';
import { getAvailableFields, getDataSourcesForLine, getDataSourceSchema, confirmMapping, promoteToProduction, processFile, type ColumnMapping, type AvailableField, type DataSource } from '../../../lib/ingestionApi';
import { listFactories, listFactoryLines, type ProductionLine } from '../../../lib/factoryApi';
import { LayoutMiniMap } from './LayoutMiniMap';
import { WIDGET_DEFINITIONS, getCompatibilityStatus } from '../registry';

export interface DashboardWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (dashboardId: string) => void;
    preselectedFactoryId?: string;
    preselectedLineId?: string;
    mode?: 'create' | 'upload';
}

type WizardStep = 'upload' | 'mapping' | 'widgets';

export const DashboardWizard: React.FC<DashboardWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
    preselectedFactoryId,
    preselectedLineId,
    mode = 'create'
}) => {
    // --- Hooks ---
    // Note: canManageInfrastructure removed - not used after removing 'add line' option

    // --- State Management (Kept existing logic) ---
    const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [rawImportId, setRawImportId] = useState<string | null>(null);
    const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
    const [validatedMappings, setValidatedMappings] = useState<ColumnMapping[]>([]);
    const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dataSourceId, setDataSourceId] = useState<string | null>(null);
    const [existingDataSources, setExistingDataSources] = useState<DataSource[]>([]);
    const [dashboardName, setDashboardName] = useState('');

    const [factories, setFactories] = useState<{ id: string, name: string, code?: string }[]>([]);
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [selectedFactoryId, setSelectedFactoryId] = useState<string>('');
    const [selectedLineId, setSelectedLineId] = useState<string>('');

    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [isLoadingLines, setIsLoadingLines] = useState(false);

    // Widget Selection State (Lifted for Sidebar Preview)
    const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);

    // Steps Configuration
    const steps = mode === 'create' ? [
        { id: 'upload', label: 'Source Data', description: 'Upload or Select Source', icon: Upload },
        { id: 'mapping', label: 'Data Mapping', description: 'Validate Columns', icon: CheckCircle },
        { id: 'widgets', label: 'Dashboard', description: 'Configure Layout', icon: Layout },
    ] : [
        { id: 'upload', label: 'Source Data', description: 'Upload CSV/Excel', icon: Upload },
        { id: 'mapping', label: 'Data Mapping', description: 'Validate Columns', icon: CheckCircle },
    ];

    // --- Effects (Kept existing logic) ---
    useEffect(() => {
        if (isOpen) {
            setCurrentStep('upload');
            setUploadedFile(null);
            setRawImportId(null);
            setColumnMappings([]);
            setValidatedMappings([]);
            setDataSourceId(null);
            setDashboardName(''); // Reset name

            if (preselectedFactoryId) setSelectedFactoryId(preselectedFactoryId);
            if (preselectedLineId) setSelectedLineId(preselectedLineId);

            const loadContext = async () => {
                setIsLoadingContext(true);
                try {
                    // FIRE AND FORGET - Fetch fields in background, don't block UI
                    getAvailableFields().then(fields => setAvailableFields(fields)).catch(console.error);

                    // BLOCKING - Only wait for factories to render the dropdown
                    const fetchedFactories = await listFactories();
                    setFactories(fetchedFactories);

                    if (!preselectedFactoryId && fetchedFactories.length > 0) {
                        setSelectedFactoryId(fetchedFactories[0].id);
                    }
                } catch (err) {
                    console.error('Failed to load wizard context:', err);
                } finally {
                    setIsLoadingContext(false);
                }
            };
            loadContext();
        }
    }, [isOpen, preselectedFactoryId, preselectedLineId]);

    useEffect(() => {
        if (selectedFactoryId) {
            const fetchLines = async () => {
                setIsLoadingLines(true);
                try {
                    const factoryLines = await listFactoryLines(selectedFactoryId);
                    setLines(factoryLines);
                    if (!selectedLineId && !preselectedLineId && factoryLines.length > 0) {
                        setSelectedLineId(factoryLines[0].id);
                    } else if (preselectedLineId) {
                        setSelectedLineId(preselectedLineId);
                    } else if (!selectedLineId && factoryLines.length === 0) {
                        setSelectedLineId('');
                    }
                } catch (error) {
                    console.error('Failed to fetch lines:', error);
                    setLines([]);
                    setSelectedLineId('');
                } finally {
                    setIsLoadingLines(false);
                }
            };
            fetchLines();
        } else {
            setLines([]);
            setSelectedLineId('');
        }
    }, [selectedFactoryId, preselectedLineId]);

    useEffect(() => {
        const checkExistingData = async () => {
            if (selectedLineId) {
                const sources = await getDataSourcesForLine(selectedLineId);
                setExistingDataSources(sources);
            } else {
                setExistingDataSources([]);
            }
        };
        checkExistingData();
    }, [selectedLineId]);

    // --- Handlers (Kept existing logic) ---


    /**
     * Handle selecting an existing file from history.
     * COMPLETE files: Load existing schema and go to mapping review
     * INCOMPLETE files: Trigger processing flow to complete HITL pipeline
     */
    const handleUseExisting = async (source: DataSource, name: string) => {
        setIsSubmitting(true);
        setDashboardName(name);

        try {
            // CASE 1: INCOMPLETE FILE - needs to go through processing first
            if (source.ingestion_status === 'incomplete' || !source.id) {
                console.log('[FLOW] Incomplete file - redirecting to processing flow');

                // Trigger processing for this raw import to get mappings
                const processingResult = await processFile(source.raw_import_id);

                // Set the raw import ID so confirm-mapping knows which file to process
                setRawImportId(source.raw_import_id);

                // Load the generated mappings into state
                setColumnMappings(processingResult.columns);

                // Go to mapping step for user review/confirmation
                setCurrentStep('mapping');
                return;
            }

            // CASE 2: COMPLETE FILE - has existing schema, load it
            console.log('[FLOW] Complete file - loading existing schema');
            const schema = await getDataSourceSchema(source.id);

            // Load schema into the "Draft" state so Step 2 can render it for review
            setColumnMappings(schema);

            // Set the DataSource ID so we know which backend source to use
            setDataSourceId(source.id);

            // Navigate to Step 2 (Mapping) for transparency - users can verify mappings
            setCurrentStep('mapping');
        } catch (error) {
            console.error('Failed to prepare existing data:', error);
            alert('Failed to load data source. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // FIX: Wrap in useCallback to ensure stable reference and prevent Child re-renders
    const handleMappingConfirmation = React.useCallback(async (mappings: ColumnMapping[]): Promise<void> => {
        // Guard: If we successfully processed this import ID already, don't do it again.
        if (validatedMappings.length > 0 && rawImportId) {
            return Promise.resolve();
        }

        // Note: We intentionally do NOT set isSubmitting(true) here.
        // Why? The WizardStep2Mapping component handles its own full-screen "Processing" UI (AIProcessingView).
        // If we set state in the Parent, the Parent re-renders, creating a new function reference
        // for this handler, which forces the Child to re-render, potentially resetting the processing loop.

        try {
            // ---------------------------------------------------------
            // PATH A: Existing Data Source (Skip raw import processing)
            // ---------------------------------------------------------
            if (dataSourceId && !rawImportId) {
                setValidatedMappings(mappings);
                return Promise.resolve();
            }

            // ---------------------------------------------------------
            // PATH B: New File Upload (Full processing)
            // ---------------------------------------------------------
            if (!rawImportId || !selectedLineId) {
                if (!selectedLineId) alert('Please select a Target Production Line.');
                throw new Error('Missing required IDs for new import.');
            }

            const confirmationData = mappings.map(m => ({
                source_column: m.source_column,
                target_field: m.target_field,
                ignored: m.ignored,
                user_corrected: m.tier === 'manual'
            }));

            // FIX: Using static imports (top of file) instead of dynamic import to avoid chunk loading issues

            // 1. Confirm Mapping
            const response = await confirmMapping({
                raw_import_id: rawImportId,
                mappings: confirmationData,
                production_line_id: selectedLineId || undefined,
                factory_id: selectedFactoryId || undefined,
                time_column: "Date",
                time_format: "YYYY-MM-DD",
                learn_corrections: true
            });

            // 2. Promote to Production
            setDataSourceId(response.data_source_id);
            await promoteToProduction(rawImportId);

            setValidatedMappings(mappings);

            // Auto-initialize selected widgets based on recommendations
            const activeFields = mappings.filter(m => !m.ignored && m.target_field).map(m => m.target_field!);
            const recommendations = WIDGET_DEFINITIONS
                .filter(w => {
                    const { status } = getCompatibilityStatus(w.id, activeFields);
                    return status === 'supported' && w.tags.includes('essential');
                })
                .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                .map(w => w.id);

            const filteredRecommendations = recommendations.filter(id => {
                const widgetDef = WIDGET_DEFINITIONS.find(w => w.id === id);
                const { status } = getCompatibilityStatus(id, activeFields);
                return status === 'supported' && !widgetDef?.locked;
            });

            setSelectedWidgets(filteredRecommendations);
            return Promise.resolve();

        } catch (error) {
            console.error('Failed to confirm mapping:', error);
            alert("Failed to process data. Please try again.");
            return Promise.reject(error);
        }
    }, [rawImportId, selectedLineId, selectedFactoryId, dataSourceId, validatedMappings.length]);

    // Memoized callbacks to prevent child re-renders that cause AIProcessingView to unmount
    const handleBackToUpload = React.useCallback(() => {
        setCurrentStep('upload');
    }, []);

    const handleAnimationComplete = React.useCallback(() => {
        if (mode === 'upload') {
            onComplete('upload-complete');
            onClose();
        } else {
            setCurrentStep('widgets');
        }
    }, [mode, onComplete, onClose]);

    if (!isOpen) return null;

    const currentStepIndex = steps.findIndex(s => s.id === currentStep);

    // Helper to determine if the upload area should be locked
    const isSelectionComplete = selectedFactoryId && selectedLineId && !isLoadingLines && !isLoadingContext;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1400px] h-[90vh] flex overflow-hidden ring-1 ring-black/5">

                {/* --- Sidebar (Navigation & Status) --- */}
                <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col hidden md:flex">
                    <div className="p-5">
                        <div className="flex items-center space-x-2 text-blue-600 mb-5">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Settings className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-gray-900 tracking-tight">LineSight Setup</span>
                        </div>

                        {/* Steps Timeline */}
                        <div className="space-y-0 relative">
                            {/* Connector Line */}
                            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />

                            {steps.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = index === currentStepIndex;
                                const isCompleted = index < currentStepIndex;

                                return (
                                    <div key={step.id} className="relative z-10 flex items-start py-3 group">
                                        <div
                                            className={`
                                                w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                                ${isActive
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-110'
                                                    : isCompleted
                                                        ? 'bg-green-500 border-green-500 text-white'
                                                        : 'bg-white border-slate-300 text-slate-400'
                                                }
                                            `}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="ml-4 mt-1">
                                            <p className={`text-sm font-semibold transition-colors ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                                                {step.label}
                                            </p>
                                            <p className="text-xs text-gray-400">{step.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Spatial Preview (Mini Map) - Only visible during Widget selection */}
                    {currentStep === 'widgets' && (
                        <div className="px-4 mb-6 animate-in fade-in slide-in-from-left-4 duration-500">
                            <LayoutMiniMap selectedWidgetIds={selectedWidgets} />
                        </div>
                    )}

                    {/* Sidebar Footer (Context Summary) */}
                    <div className="mt-auto p-4 border-t border-slate-200 bg-slate-100/50">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Current Context</div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
                            <div className="flex items-center text-sm text-gray-700">
                                <Factory className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                <span className="truncate">{factories.find(f => f.id === selectedFactoryId)?.name || 'Select Factory'}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-700">
                                <ChevronRight className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                <span className="truncate font-medium">{lines.find(l => l.id === selectedLineId)?.name || 'Select Line'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Main Content Area --- */}
                <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                    {/* Floating Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close wizard"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Scrollable Body - generous top padding for breathing room */}
                    <div className="flex-1 overflow-y-auto px-8 pt-10">

                        {/* Step 1: Context Selection & Upload */}
                        {currentStep === 'upload' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                {/* Sleek Context Selection Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                    {/* Factory Display - Read only when preselected, selectable otherwise */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-700">Factory</label>
                                            {isLoadingContext && (
                                                <span className="flex items-center text-xs text-blue-600 animate-pulse">
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    Loading...
                                                </span>
                                            )}
                                        </div>
                                        {preselectedFactoryId ? (
                                            // Read-only display when factory is preselected (user is already in that factory)
                                            <div className="block w-full pl-3 pr-10 py-2.5 bg-gray-100 border-0 ring-1 ring-gray-200 rounded-lg text-sm text-gray-700">
                                                {factories.find(f => f.id === preselectedFactoryId)?.name || 'Loading...'}
                                            </div>
                                        ) : (
                                            // Selectable dropdown when no factory is preselected
                                            <div className="relative">
                                                <select
                                                    value={selectedFactoryId}
                                                    onChange={(e) => setSelectedFactoryId(e.target.value)}
                                                    className="block w-full pl-3 pr-10 py-2.5 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-shadow disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                                    disabled={isLoadingContext}
                                                >
                                                    <option value="">
                                                        {isLoadingContext ? 'Loading Factories...' : 'Select Factory...'}
                                                    </option>
                                                    {factories.map(f => (
                                                        <option key={f.id} value={f.id}>{f.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* Line Selection */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-700">Production Line</label>
                                            {isLoadingLines && (
                                                <span className="flex items-center text-xs text-blue-600 animate-pulse">
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    Fetching lines...
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={selectedLineId}
                                                onChange={(e) => setSelectedLineId(e.target.value)}
                                                className="block w-full pl-3 pr-10 py-2.5 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-shadow disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                                disabled={!selectedFactoryId || isLoadingLines || isLoadingContext}
                                            >
                                                <option value="">
                                                    {!selectedFactoryId
                                                        ? 'Select Factory First'
                                                        : isLoadingLines
                                                            ? 'Loading Lines...'
                                                            : 'Select Line...'}
                                                </option>
                                                {lines.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Warning when no lines exist */}
                                {selectedFactoryId && lines.length === 0 && !isLoadingLines && (
                                    <div className="bg-amber-50 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                                        <span>No production lines available. Configure lines from the Factory settings page first.</span>
                                    </div>
                                )}

                                {/* 
                                    GRACEFUL HANDLING:
                                    We wrap the Upload component in a div.
                                    If selection isn't complete (loading or empty), we reduce opacity 
                                    and disable pointer events.
                                */}
                                <div
                                    className={`
                                        border-t border-gray-100 pt-6 transition-all duration-500
                                        ${!isSelectionComplete ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}
                                    `}
                                >
                                    <div className="relative">
                                        <WizardStep1Upload
                                            existingDataSources={existingDataSources}
                                            onUseExisting={handleUseExisting}
                                        />

                                        {/* Optional: Add a friendly message overlay if waiting */}
                                        {!isSelectionComplete && !isLoadingContext && !isLoadingLines && (
                                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                                <div className="bg-white/80 px-4 py-2 rounded-full shadow-sm text-sm text-gray-500 font-medium">
                                                    Select a Production Line to continue
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Mapping */}
                        {currentStep === 'mapping' && (
                            <div className="h-full animate-in fade-in slide-in-from-right-4 duration-300">
                                <WizardStep2Mapping
                                    mappings={columnMappings}
                                    availableFields={availableFields}
                                    filename={uploadedFile?.name || 'Uploaded File'}
                                    onMappingValidated={handleMappingConfirmation}
                                    onBack={handleBackToUpload}
                                    onAnimationComplete={handleAnimationComplete}
                                />
                            </div>
                        )}

                        {/* Step 3: Widgets */}
                        {currentStep === 'widgets' && (
                            <div className="h-full animate-in fade-in slide-in-from-right-4 duration-300">
                                <WizardStep3Widgets
                                    mapping={validatedMappings}
                                    selectedWidgets={selectedWidgets}
                                    setSelectedWidgets={setSelectedWidgets}
                                    onComplete={async (config) => {
                                        try {
                                            const { createDashboard } = await import('../../../lib/dashboardApi');

                                            // [Simulated Delay]
                                            await new Promise(resolve => setTimeout(resolve, 200));

                                            const res = await createDashboard({
                                                name: dashboardName, // Use state from Step 1
                                                description: `Generated from ${uploadedFile?.name || 'existing source'}`,
                                                data_source_id: dataSourceId!,
                                                production_line_id: selectedLineId,
                                                widget_config: { enabled_widgets: config.widgets.map(w => w.widget), widget_settings: {} },
                                                layout_config: { layouts: config.widgets.map(w => ({ widget_id: w.i, x: w.x, y: w.y, w: w.w, h: w.h })) }
                                            });
                                            onComplete(res.id);
                                            onClose();
                                        } catch (error) {
                                            console.error(error);
                                            alert("Failed to create dashboard");
                                        }
                                    }}
                                    onBack={() => setCurrentStep('mapping')}
                                />
                            </div>
                        )}
                    </div>

                    {/* Dev Actions (Hidden nicely) */}
                    <div className="absolute bottom-2 left-8 opacity-0 hover:opacity-100 transition-opacity">
                        <button
                            onClick={async () => {
                                if (window.confirm('Reset System?')) {
                                    const { resetSystemState } = await import('../../../lib/factoryApi');
                                    await resetSystemState();
                                    window.location.reload();
                                }
                            }}
                            className="text-[10px] text-red-300 hover:text-red-500 font-mono"
                        >
                            DEV_RESET
                        </button>
                    </div>

                    {/* Processing Overlay */}
                    {isSubmitting && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] z-50 flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900">Processing Data</h3>
                                <p className="text-gray-500 text-sm">Validating structure and importing...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
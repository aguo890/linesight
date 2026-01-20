import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, Layout, Factory, ChevronRight, Settings, AlertCircle, Loader2 } from 'lucide-react';
// Note: useNavigate and canManageInfrastructure removed - no longer navigating to add line from wizard
import { useTranslation } from 'react-i18next';
import { WizardStep1Upload } from './wizard/WizardStep1Upload';
import { WizardStep2Mapping } from './wizard/WizardStep2Mapping';
import { WizardStep3Widgets } from './wizard/WizardStep3Widgets';
import { getAvailableFields, getDataSourcesForLine, getDataSourceSchema, confirmMapping, promoteToProduction, processFile, type ColumnMapping, type AvailableField, type DataSource } from '../../../lib/ingestionApi';
import { listFactories, listDataSources, type DataSource as FactoryDataSource } from '../../../lib/factoryApi';
import { LayoutMiniMap } from './LayoutMiniMap';
import { WIDGET_DEFINITIONS, getCompatibilityStatus } from '../registry';

export interface DashboardWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (dashboardId: string) => void;
    preselectedFactoryId?: string;
    preselectedDataSourceId?: string;
    mode?: 'create' | 'upload';
}

type WizardStep = 'upload' | 'mapping' | 'widgets';

export const DashboardWizard: React.FC<DashboardWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
    preselectedFactoryId,
    preselectedDataSourceId,
    mode = 'create'
}) => {
    const { t } = useTranslation();
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
    const [dataSources, setDataSources] = useState<FactoryDataSource[]>([]);
    const [selectedFactoryId, setSelectedFactoryId] = useState<string>('');
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>('');

    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [isLoadingSources, setIsLoadingSources] = useState(false);

    // Widget Selection State (Lifted for Sidebar Preview)
    const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);

    // Option A: Track if we skipped upload/mapping steps (for back button handling)
    const [skippedToWidgets, setSkippedToWidgets] = useState(false);

    // Steps Configuration
    const steps = mode === 'create' ? [
        { id: 'upload', label: t('wizard.steps.upload.label'), description: t('wizard.steps.upload.desc'), icon: Upload },
        { id: 'mapping', label: t('wizard.steps.mapping.label'), description: t('wizard.steps.mapping.desc'), icon: CheckCircle },
        { id: 'widgets', label: t('wizard.steps.widgets.label'), description: t('wizard.steps.widgets.desc'), icon: Layout },
    ] : [
        { id: 'upload', label: t('wizard.steps.upload.label'), description: t('wizard.steps.upload.desc_alt'), icon: Upload },
        { id: 'mapping', label: t('wizard.steps.mapping.label'), description: t('wizard.steps.mapping.desc'), icon: CheckCircle },
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
            if (preselectedDataSourceId) setSelectedDataSourceId(preselectedDataSourceId);

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
    }, [isOpen, preselectedFactoryId, preselectedDataSourceId]);

    useEffect(() => {
        if (selectedFactoryId) {
            const fetchSources = async () => {
                setIsLoadingSources(true);
                try {
                    const factorySources = await listDataSources(selectedFactoryId);
                    setDataSources(factorySources);
                    if (!selectedDataSourceId && !preselectedDataSourceId && factorySources.length > 0) {
                        setSelectedDataSourceId(factorySources[0].id);
                    } else if (preselectedDataSourceId) {
                        setSelectedDataSourceId(preselectedDataSourceId);
                    } else if (!selectedDataSourceId && factorySources.length === 0) {
                        setSelectedDataSourceId('');
                    }
                } catch (error) {
                    console.error('Failed to fetch data sources:', error);
                    setDataSources([]);
                    setSelectedDataSourceId('');
                } finally {
                    setIsLoadingSources(false);
                }
            };
            fetchSources();
        } else {
            setDataSources([]);
            setSelectedDataSourceId('');
        }
    }, [selectedFactoryId, preselectedDataSourceId]);

    useEffect(() => {
        const checkExistingData = async () => {
            if (selectedDataSourceId) {
                try {
                    // Fetch files uploaded for this Data Source
                    const sources = await getDataSourcesForLine(selectedDataSourceId);
                    setExistingDataSources(sources);
                } catch {
                    setExistingDataSources([]);
                }
            } else {
                setExistingDataSources([]);
            }
        };
        checkExistingData();
    }, [selectedDataSourceId]);

    // --- Handlers ---

    /**
     * Skip to widget configuration for mature data sources.
     * OPTION A: Called when user clicks "Configure Widgets" on a source with active schema.
     */
    const handleSkipToWidgets = React.useCallback((sourceId: string, sourceName: string, dashName: string) => {
        console.log(`[Wizard] Skipping to widgets for mature source: ${sourceName}`);

        setDashboardName(dashName);
        setDataSourceId(sourceId);
        setSelectedDataSourceId(sourceId);
        setSkippedToWidgets(true);

        // Auto-recommend widgets based on available data (empty mappings = show all compatible)
        const recommendations = WIDGET_DEFINITIONS
            .filter(w => w.tags.includes('essential') && !w.locked)
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .map(w => w.id);
        setSelectedWidgets(recommendations);

        setCurrentStep('widgets');
    }, []);

    /**
     * Handle back button from widgets step.
     * GUARDRAIL: If we skipped steps, go back to source selection, not mapping.
     */
    const handleBackFromWidgets = React.useCallback(() => {
        if (skippedToWidgets) {
            // We skipped upload/mapping, go back to source selection
            setCurrentStep('upload');
            setDataSourceId(null);
            setSelectedDataSourceId('');
            setSkippedToWidgets(false);
        } else {
            // Normal flow - go back to mapping
            setCurrentStep('mapping');
        }
    }, [skippedToWidgets]);


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
            if (!rawImportId || !selectedDataSourceId) {
                if (!selectedDataSourceId) alert('Please select a Target Data Source.');
                throw new Error('Missing required IDs for new import.');
            }

            const confirmationData = mappings.map(m => ({
                source_column: m.source_column,
                target_field: m.target_field,
                ignored: m.ignored,
                user_corrected: m.tier === 'manual'
            }));

            // 1. Confirm Mapping
            const response = await confirmMapping({
                raw_import_id: rawImportId,
                mappings: confirmationData,
                // Correctly passing the Data Source ID to the backend
                production_line_id: selectedDataSourceId || undefined,
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
    }, [rawImportId, selectedDataSourceId, selectedFactoryId, dataSourceId, validatedMappings.length]);

    // Memoized callbacks
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
    const isSelectionComplete = selectedFactoryId && selectedDataSourceId && !isLoadingSources && !isLoadingContext;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-2xl shadow-2xl w-[95vw] max-w-[1400px] h-[90vh] flex overflow-hidden ring-1 ring-black/5 dark:ring-white/10">

                {/* --- Sidebar (Navigation & Status) --- */}
                <div className="w-72 bg-surface-subtle border-e border-border flex flex-col hidden md:flex">
                    <div className="p-5">
                        <div className="flex items-center space-x-2 text-brand mb-5">
                            <div className="p-2 bg-brand/10 rounded-lg">
                                <Settings className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-text-main tracking-tight">{t('wizard.title')}</span>
                        </div>

                        {/* Steps Timeline */}
                        <div className="space-y-0 relative">
                            {/* Connector Line */}
                            <div className="absolute start-4 top-4 bottom-4 w-0.5 bg-border" />

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
                                                    ? 'bg-brand border-brand text-white shadow-md scale-110'
                                                    : isCompleted
                                                        ? 'bg-emerald-500 border-emerald-500 text-white dark:bg-emerald-600 dark:border-emerald-600'
                                                        : 'bg-surface border-border text-text-muted'
                                                }
                                            `}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="ms-4 mt-1">
                                            <p className={`text-sm font-semibold transition-colors ${isActive ? 'text-text-main' : 'text-text-muted'}`}>
                                                {step.label}
                                            </p>
                                            <p className="text-xs text-text-muted">{step.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Spatial Preview (Mini Map) - Only visible during Widget selection */}
                    {currentStep === 'widgets' && (
                        <div className="px-4 mb-6 animate-in fade-in slide-in-from-start-4 duration-500">
                            <LayoutMiniMap selectedWidgetIds={selectedWidgets} />
                        </div>
                    )}

                    {/* Sidebar Footer (Context Summary) */}
                    <div className="mt-auto p-4 border-t border-border bg-surface-subtle/50">
                        <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">{t('wizard.context.title')}</div>
                        <div className="bg-surface p-3 rounded-lg border border-border shadow-sm space-y-2">
                            <div className="flex items-center text-sm text-text-main">
                                <Factory className="w-3.5 h-3.5 me-2 text-text-muted" />
                                <span className="truncate">{factories.find(f => f.id === selectedFactoryId)?.name || t('wizard.context.select_factory')}</span>
                            </div>
                            <div className="flex items-center text-sm text-text-main">
                                <ChevronRight className="w-3.5 h-3.5 me-2 text-text-muted rtl:rotate-180" />
                                <span className="truncate font-medium">{dataSources.find(ds => ds.id === selectedDataSourceId)?.name || t('wizard.context.select_source')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Main Content Area --- */}
                <div className="flex-1 flex flex-col min-w-0 bg-surface relative">
                    {/* Floating Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 end-4 z-20 p-2 text-text-muted hover:text-text-main hover:bg-surface-subtle rounded-lg transition-colors"
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
                                            <label className="block text-sm font-medium text-text-main">Factory</label>
                                            {isLoadingContext && (
                                                <span className="flex items-center text-xs text-brand animate-pulse">
                                                    <Loader2 className="w-3 h-3 me-1 animate-spin" />
                                                    Loading...
                                                </span>
                                            )}
                                        </div>
                                        {preselectedFactoryId ? (
                                            // Read-only display when factory is preselected (user is already in that factory)
                                            <div className="block w-full ps-3 pe-10 py-2.5 bg-surface-subtle border-0 ring-1 ring-border rounded-lg text-sm text-text-main">
                                                {factories.find(f => f.id === preselectedFactoryId)?.name || 'Loading...'}
                                            </div>
                                        ) : (
                                            // Selectable dropdown when no factory is preselected
                                            <div className="relative">
                                                <select
                                                    value={selectedFactoryId}
                                                    onChange={(e) => setSelectedFactoryId(e.target.value)}
                                                    className="block w-full ps-3 pe-10 py-2.5 bg-surface-subtle border-0 ring-1 ring-border rounded-lg focus:ring-2 focus:ring-brand/50 text-sm text-text-main transition-shadow disabled:bg-surface-subtle disabled:text-text-muted disabled:cursor-not-allowed"
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

                                    {/* Data Source Selection */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-text-main">Data Source</label>
                                            {isLoadingSources && (
                                                <span className="flex items-center text-xs text-brand animate-pulse">
                                                    <Loader2 className="w-3 h-3 me-1 animate-spin" />
                                                    {t('wizard.context.fetching_sources')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={selectedDataSourceId}
                                                onChange={(e) => setSelectedDataSourceId(e.target.value)}
                                                className="block w-full ps-3 pe-10 py-2.5 bg-surface-subtle border-0 ring-1 ring-border rounded-lg focus:ring-2 focus:ring-brand/50 text-sm text-text-main transition-shadow disabled:bg-surface-subtle disabled:text-text-muted disabled:cursor-not-allowed"
                                                disabled={!selectedFactoryId || isLoadingSources || isLoadingContext}
                                            >
                                                <option value="">
                                                    {!selectedFactoryId
                                                        ? t('wizard.context.select_factory_first')
                                                        : isLoadingSources
                                                            ? t('wizard.context.loading_sources')
                                                            : t('wizard.context.select_source') + '...'}
                                                </option>
                                                {dataSources.map(ds => (
                                                    <option key={ds.id} value={ds.id}>{ds.name} ({ds.code})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Warning when no sources exist */}
                                {selectedFactoryId && dataSources.length === 0 && !isLoadingSources && (
                                    <div className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 px-4 py-3 rounded-lg text-sm flex items-center">
                                        <AlertCircle className="w-4 h-4 me-2 flex-shrink-0" />
                                        <span>{t('wizard.context.no_sources_alert')}</span>
                                    </div>
                                )}

                                {/* OPTION A: Skip to Widgets for Mature Data Sources */}
                                {(() => {
                                    const selectedSource = dataSources.find(ds => ds.id === selectedDataSourceId);
                                    if (selectedSource?.has_active_schema && isSelectionComplete) {
                                        return (
                                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-5 space-y-3">
                                                <div className="flex items-center text-emerald-700 dark:text-emerald-400">
                                                    <CheckCircle className="w-5 h-5 me-2" />
                                                    <span className="font-semibold">{t('wizard.mature_source.title', 'Schema Ready')}</span>
                                                </div>
                                                <p className="text-sm text-emerald-600 dark:text-emerald-300">
                                                    {t('wizard.mature_source.description', 'This data source has a confirmed schema. You can skip directly to widget configuration.')}
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder={t('wizard.step1.dashboard_name_placeholder', 'Enter dashboard name')}
                                                        value={dashboardName}
                                                        onChange={(e) => setDashboardName(e.target.value)}
                                                        className="flex-1 px-3 py-2 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm bg-surface text-text-main focus:ring-2 focus:ring-emerald-500"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (!dashboardName.trim()) {
                                                                alert(t('wizard.step1.name_error_tooltip', 'Please enter a dashboard name'));
                                                                return;
                                                            }
                                                            handleSkipToWidgets(selectedSource.id, selectedSource.name, dashboardName);
                                                        }}
                                                        disabled={!dashboardName.trim()}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                                    >
                                                        {t('wizard.mature_source.continue_button', 'Configure Widgets')}
                                                        <ChevronRight className="w-4 h-4 ms-1 rtl:rotate-180" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* 
                                    GRACEFUL HANDLING:
                                    We wrap the Upload component in a div.
                                    If selection isn't complete (loading or empty), we reduce opacity 
                                    and disable pointer events.
                                */}
                                <div
                                    className={`
                                        border-t border-border pt-6 transition-all duration-500
                                        ${!isSelectionComplete ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}
                                    `}
                                >
                                    <div className="relative">
                                        <WizardStep1Upload
                                            existingDataSources={existingDataSources}
                                            onUseExisting={handleUseExisting}
                                        />

                                        {/* Optional: Add a friendly message overlay if waiting */}
                                        {!isSelectionComplete && !isLoadingContext && !isLoadingSources && (
                                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                                <div className="bg-surface/80 px-4 py-2 rounded-full shadow-sm text-sm text-text-muted font-medium">
                                                    {t('wizard.context.select_source_overlay')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Mapping */}
                        {currentStep === 'mapping' && (
                            <div className="h-full animate-in fade-in slide-in-from-end-4 duration-300">
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
                            <div className="h-full animate-in fade-in slide-in-from-end-4 duration-300">
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
                                                production_line_id: selectedDataSourceId, // Using DS ID as Line ID for now
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
                                    onBack={handleBackFromWidgets}
                                />
                            </div>
                        )}
                    </div>

                    {/* Dev Actions (Hidden nicely) */}
                    <div className="absolute bottom-2 start-8 opacity-0 hover:opacity-100 transition-opacity">
                        <button
                            onClick={async () => {
                                if (window.confirm('Reset System?')) {
                                    const { resetSystemState } = await import('../../../lib/factoryApi');
                                    await resetSystemState();
                                    window.location.reload();
                                }
                            }}
                            className="text-[10px] text-status-error/50 hover:text-status-error font-mono"
                        >
                            DEV_RESET
                        </button>
                    </div>

                    {/* Processing Overlay */}
                    {isSubmitting && (
                        <div className="absolute inset-0 bg-surface/90 backdrop-blur-[1px] z-50 flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-4" />
                                <h3 className="text-lg font-semibold text-text-main">Processing Data</h3>
                                <p className="text-text-muted text-sm">Validating structure and importing...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
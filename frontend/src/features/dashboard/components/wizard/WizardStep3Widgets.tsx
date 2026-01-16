import React, { useState, useMemo } from 'react';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WIDGET_DEFINITIONS, getCompatibilityStatus, WIDGET_BUNDLES, getBundleReadiness } from '../../registry';
import type { DashboardWidgetConfig } from '../../config';
import type { ColumnMapping } from '../../../../lib/ingestionApi';
import { WidgetSelector } from '../WidgetSelector';
import { BlueprintCard } from '../BlueprintCard';
import { calculateSmartLayout } from '../../../../utils/layoutUtils';

export interface DashboardConfiguration {
    widgets: DashboardWidgetConfig[];
}

interface WizardStep3WidgetsProps {
    mapping: ColumnMapping[];
    selectedWidgets: string[];
    setSelectedWidgets: (widgets: string[]) => void;
    onComplete: (config: DashboardConfiguration) => void;
    onBack: () => void;
}

export const WizardStep3Widgets: React.FC<WizardStep3WidgetsProps> = ({
    mapping,
    selectedWidgets,
    setSelectedWidgets,
    onComplete,
    onBack,
}) => {
    const { t } = useTranslation();
    const [isCreating, setIsCreating] = useState(false);

    // 1. Identify all available columns from the mapping step
    const activeFields = useMemo(() =>
        mapping.filter(m => !m.ignored && m.target_field).map(m => m.target_field!),
        [mapping]);

    // 2. Bundle readiness for each blueprint
    const bundleReadinessMap = useMemo(() => {
        return WIDGET_BUNDLES.reduce((acc, bundle) => {
            acc[bundle.id] = getBundleReadiness(bundle.id, activeFields);
            return acc;
        }, {} as Record<string, ReturnType<typeof getBundleReadiness>>);
    }, [activeFields]);

    // 3. Handler for applying a bundle
    const handleApplyBundle = (widgetIds: string[]) => {
        // Filter to only supported widgets that are NOT locked
        const allowedIds = widgetIds.filter(id => {
            const widgetDef = WIDGET_DEFINITIONS.find(w => w.id === id);
            const { status } = getCompatibilityStatus(id, activeFields);
            return status === 'supported' && !widgetDef?.locked;
        });
        setSelectedWidgets(allowedIds);
    };

    // 4. Create sample data map: target_field -> sample values
    const sampleDataByField = useMemo(() => {
        const result: Record<string, (string | number | null)[]> = {};
        mapping.forEach(m => {
            if (!m.ignored && m.target_field && m.sample_data?.length > 0) {
                result[m.target_field] = m.sample_data as (string | number | null)[];
            }
        });
        return result;
    }, [mapping]);

    const toggleWidget = (widgetId: string) => {
        setSelectedWidgets(
            selectedWidgets.includes(widgetId)
                ? selectedWidgets.filter(id => id !== widgetId)
                : [...selectedWidgets, widgetId]
        );
    };

    const handleConfirm = async () => {
        setIsCreating(true);

        try {
            // 1. Prepare items with dimensions from registry
            const layoutInput = selectedWidgets.map((widgetId) => {
                const widgetDef = WIDGET_DEFINITIONS.find(w => w.id === widgetId);
                if (!widgetDef) return null;

                return {
                    id: widgetId,
                    widget: widgetId,
                    w: widgetDef.defaultW,
                    h: widgetDef.defaultH,
                    minW: widgetDef.minW,
                    minH: widgetDef.minH,
                };
            }).filter(Boolean) as Array<{
                id: string;
                widget: string;
                w: number;
                h: number;
                minW: number;
                minH: number;
            }>;

            // 2. Run Smart Packing (sorts by height/width, finds optimal positions)
            const smartLayout = calculateSmartLayout(layoutInput);

            // 3. Map to final DashboardWidgetConfig format
            const widgetConfigs: DashboardWidgetConfig[] = smartLayout.map((item) => ({
                i: `${item.widget}-${crypto.randomUUID().slice(0, 8)}`,
                widget: item.widget,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
            }));

            // Complete immediately
            onComplete({ widgets: widgetConfigs });
        } catch (error) {
            console.error('Failed to configure dashboard:', error);
            setIsCreating(false);
        }
    };


    // Calculate count for UI feedback
    const selectionCount = selectedWidgets.length;

    return (
        <div className="flex flex-col h-full -mx-6 -my-6">
            {/* Scrollable Widget Selection Area */}
            <div className="flex-1 overflow-y-auto bg-surface-subtle px-6 py-6">
                {/* Main Content (Marketplace) */}
                <div className="max-w-5xl mx-auto">
                    {/* Blueprint Bundles Section */}
                    <div className="mb-8">
                        <h3 className="text-sm font-medium text-text-main mb-3">
                            {t('wizard.step3.blueprints_title')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {WIDGET_BUNDLES.map(bundle => (
                                <BlueprintCard
                                    key={bundle.id}
                                    bundle={bundle}
                                    readiness={bundleReadinessMap[bundle.id]}
                                    onApply={() => handleApplyBundle(bundle.widgetIds)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-text-muted font-medium uppercase tracking-wider">{t('wizard.step3.divider')}</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Widget Marketplace */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-text-main">
                            {t('wizard.step3.library_title')}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                            {t('wizard.step3.selected_count', { count: selectionCount })}
                        </span>
                    </div>

                    <WidgetSelector
                        variant="wizard"
                        availableFields={activeFields}
                        selectedWidgets={selectedWidgets}
                        onSelect={toggleWidget}
                        onSelectMany={setSelectedWidgets}
                        sampleData={sampleDataByField}
                    />
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="bg-surface border-t border-border pt-4 px-6 md:px-8 mt-auto">
                <div className="flex justify-between items-center max-w-5xl mx-auto pb-4">
                    <button
                        onClick={onBack}
                        disabled={isCreating}
                        className="flex items-center px-4 py-2 text-sm font-medium text-text-muted bg-surface border border-border rounded-lg hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all disabled:opacity-50"
                    >
                        <ArrowLeft className="w-4 h-4 me-2" />
                        {t('common.back')}
                    </button>

                    <button
                        onClick={handleConfirm}
                        disabled={isCreating || selectionCount === 0}
                        className={`
                            flex items-center px-6 py-2 text-sm font-medium text-white rounded-lg shadow-sm
                            transition-all focus:outline-none focus:ring-2 focus:ring-brand/50
                            ${isCreating || selectionCount === 0
                                ? 'bg-surface-disabled text-text-muted cursor-not-allowed border border-border'
                                : 'bg-brand hover:bg-brand-dark hover:shadow-md'
                            }
                        `}
                    >
                        {isCreating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin me-2" />
                                {t('wizard.step3.btn_configuring')}
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4 me-2" />
                                {t('wizard.step3.btn_create')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
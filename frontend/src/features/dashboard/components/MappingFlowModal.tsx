/**
 * Mapping Flow Modal
 * 
 * Orchestrates the HITL mapping flow:
 * 1. Fetches available fields
 * 2. Triggers file processing (waterfall matching)
 * 3. Displays mapping interface (WizardStep2Mapping)
 * 4. Saves confirmed mappings
 */
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { WizardStep2Mapping } from './wizard/WizardStep2Mapping';

interface MappingFlowModalProps {
    isOpen: boolean;
    onClose: () => void;
    rawImportId: string | null;
    dataSourceId: string | null; // Required for confirmation
    onSuccess: () => void;
}

export const MappingFlowModal: React.FC<MappingFlowModalProps> = ({
    isOpen,
    onClose,
    rawImportId,
    dataSourceId,
    onSuccess
}) => {
    const [loading, setLoading] = useState(true);
    const [mappings, setMappings] = useState<any[]>([]);
    const [availableFields, setAvailableFields] = useState<any[]>([]);
    const [filename, setFilename] = useState<string>('');
    // Processing logic state
    const [confirming, setConfirming] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen && rawImportId) {
            initializeFlow(rawImportId);
        } else {
            // Reset state when closed
            setLoading(true);
            setMappings([]);
        }
    }, [isOpen, rawImportId]);

    const initializeFlow = async (id: string) => {
        setLoading(true);

        try {
            // 1. Fetch available fields
            // 2. Process the file to get initial suggestions
            const [fieldsRes, processRes] = await Promise.all([
                api.get('/ingestion/fields'),
                api.post(`/ingestion/process/${id}`, {}, {
                    params: { llm_enabled: true }
                })
            ]);

            setAvailableFields(fieldsRes.data);
            setMappings(processRes.data.columns);
            setFilename(processRes.data.filename);

        } catch (err: any) {
            console.error('Mapping flow initialization failed:', err);
            addToast(err.response?.data?.detail || 'Failed to initialize mapping flow', 'error', 0);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmMapping = async (confirmedMappings: any[]) => {
        if (!rawImportId || !dataSourceId) {
            addToast('Missing import or data source ID', 'error', 0);
            return;
        }

        setConfirming(true);
        try {
            const timeMapping = confirmedMappings.find(
                m => m.target_field && (m.target_field.toLowerCase() === 'timestamp' || m.target_field.toLowerCase() === 'date')
            );

            // Default to first column if no time column found ? Or error?
            // For now, let's assume one is mapped or pick the first one as fallback to avoid hard crash, 
            // but ideally we should validate this in UI.
            const timeColumn = timeMapping ? timeMapping.source_column : confirmedMappings[0]?.source_column;

            const payload = {
                raw_import_id: rawImportId,
                mappings: confirmedMappings.map(m => ({
                    source_column: m.source_column,
                    target_field: m.target_field,
                    ignored: m.ignored,
                    user_corrected: m.tier === 'manual'
                })),
                time_column: timeColumn,
                production_line_id: dataSourceId, // Alias for backend compatibility
                learn_corrections: true
            };

            await api.post('/ingestion/confirm-mapping', payload);

            // NEW: Promote data to production tables so it shows in widgets
            await api.post(`/ingestion/promote/${rawImportId}`);

            addToast("Data source created and mapped successfully!", "success");
            onSuccess();

            // DELAY: Ensure toast propagates before unmount
            setTimeout(() => {
                onClose();
            }, 50);

        } catch (err: any) {
            console.error('Failed to confirm mapping:', err);
            addToast(err.response?.data?.detail || 'Failed to save mappings', 'error', 0);
        } finally {
            setConfirming(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-xl font-bold text-text-main">Map Data Columns</h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-subtle rounded-lg text-text-muted hover:text-text-main transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-8 h-8 text-brand animate-spin" />
                            <p className="text-text-muted">Analyzing file structure...</p>
                        </div>
                    ) : (
                        <WizardStep2Mapping
                            mappings={mappings}
                            availableFields={availableFields}
                            onMappingValidated={handleConfirmMapping}
                            onBack={onClose}
                            filename={filename}
                        />
                    )}
                </div>

                {/* Overlay for confirming state */}
                {confirming && (
                    <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-10">
                        <div className="text-center">
                            <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto mb-2" />
                            <p className="text-text-muted font-medium">Saving mappings...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * useIngestion Hook
 * 
 * Manages the file ingestion workflow including upload, processing, and mapping.
 * Provides state management for the multi-step ingestion wizard.
 */
import { useState, useCallback } from 'react';
import {
    uploadFileForIngestion,
    processFile,
    confirmMapping,
    getFilePreview,
    getMappingState,
    getDryRunPreview,
    getAvailableFields,
} from '../lib/ingestionApi';
import type {
    ColumnMapping,
    UploadResponse,
    ProcessingResponse,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    FilePreview,
    DryRunResponse,
    AvailableField,
} from '../types/ingestion';

// =============================================================================
// Types
// =============================================================================

export type IngestionStep = 'idle' | 'uploading' | 'processing' | 'mapping' | 'confirming' | 'complete' | 'error';

export interface IngestionState {
    /** Current step in the workflow */
    step: IngestionStep;
    /** Raw import ID from upload */
    rawImportId: string | null;
    /** Filename */
    filename: string | null;
    /** Column mappings from processing */
    mappings: ColumnMapping[];
    /** Error message if any */
    error: string | null;
    /** Loading state */
    isLoading: boolean;
}

export interface UseIngestionReturn extends IngestionState {
    /** Upload a file */
    upload: (file: File, factoryId?: string, dataSourceId?: string) => Promise<UploadResponse>;
    /** Process an uploaded file */
    process: (options?: { factoryId?: string; llmEnabled?: boolean }) => Promise<ProcessingResponse>;
    /** Get current mapping state without reprocessing */
    getMappings: () => Promise<ProcessingResponse>;
    /** Confirm mappings and complete import */
    confirm: (request: Omit<ConfirmMappingRequest, 'raw_import_id'>) => Promise<ConfirmMappingResponse>;
    /** Get file preview data */
    getPreview: () => Promise<FilePreview>;
    /** Get dry run preview */
    getDryRun: () => Promise<DryRunResponse>;
    /** Get available target fields */
    getFields: () => Promise<AvailableField[]>;
    /** Update mappings locally */
    updateMappings: (mappings: ColumnMapping[]) => void;
    /** Reset state */
    reset: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

const initialState: IngestionState = {
    step: 'idle',
    rawImportId: null,
    filename: null,
    mappings: [],
    error: null,
    isLoading: false,
};

/**
 * Hook for managing the file ingestion workflow.
 * 
 * @example
 * ```tsx
 * const { upload, process, confirm, step, mappings } = useIngestion();
 * 
 * // Upload file
 * await upload(file, factoryId, dataSourceId);
 * 
 * // Process through matching engine
 * await process({ llmEnabled: true });
 * 
 * // Confirm mappings
 * await confirm({ mappings: [...], time_column: 'Date' });
 * ```
 */
export function useIngestion(): UseIngestionReturn {
    const [state, setState] = useState<IngestionState>(initialState);

    // Upload a file
    const upload = useCallback(async (
        file: File,
        factoryId?: string,
        dataSourceId?: string
    ): Promise<UploadResponse> => {
        setState(prev => ({ ...prev, step: 'uploading', isLoading: true, error: null }));

        try {
            const response = await uploadFileForIngestion(file, factoryId, dataSourceId);
            setState(prev => ({
                ...prev,
                step: 'processing',
                rawImportId: response.raw_import_id,
                filename: response.filename,
                isLoading: false,
            }));
            return response;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Upload failed';
            setState(prev => ({ ...prev, step: 'error', error: errorMsg, isLoading: false }));
            throw err;
        }
    }, []);

    // Process the uploaded file
    const process = useCallback(async (
        options?: { factoryId?: string; llmEnabled?: boolean }
    ): Promise<ProcessingResponse> => {
        if (!state.rawImportId) {
            throw new Error('No file uploaded');
        }

        setState(prev => ({ ...prev, step: 'processing', isLoading: true, error: null }));

        try {
            const response = await processFile(state.rawImportId, options);
            setState(prev => ({
                ...prev,
                step: 'mapping',
                mappings: response.columns,
                isLoading: false,
            }));
            return response;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Processing failed';
            setState(prev => ({ ...prev, step: 'error', error: errorMsg, isLoading: false }));
            throw err;
        }
    }, [state.rawImportId]);

    // Get current mapping state
    const getMappings = useCallback(async (): Promise<ProcessingResponse> => {
        if (!state.rawImportId) {
            throw new Error('No file uploaded');
        }

        setState(prev => ({ ...prev, isLoading: true }));

        try {
            const response = await getMappingState(state.rawImportId);
            setState(prev => ({
                ...prev,
                mappings: response.columns,
                isLoading: false,
            }));
            return response;
        } catch (err) {
            setState(prev => ({ ...prev, isLoading: false }));
            throw err;
        }
    }, [state.rawImportId]);

    // Confirm mappings
    const confirm = useCallback(async (
        request: Omit<ConfirmMappingRequest, 'raw_import_id'>
    ): Promise<ConfirmMappingResponse> => {
        if (!state.rawImportId) {
            throw new Error('No file uploaded');
        }

        setState(prev => ({ ...prev, step: 'confirming', isLoading: true, error: null }));

        try {
            const response = await confirmMapping({
                ...request,
                raw_import_id: state.rawImportId,
            });
            setState(prev => ({
                ...prev,
                step: 'complete',
                isLoading: false,
            }));
            return response;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Confirmation failed';
            setState(prev => ({ ...prev, step: 'error', error: errorMsg, isLoading: false }));
            throw err;
        }
    }, [state.rawImportId]);

    // Get file preview
    const getPreview = useCallback(async (): Promise<FilePreview> => {
        if (!state.rawImportId) {
            throw new Error('No file uploaded');
        }
        return getFilePreview(state.rawImportId);
    }, [state.rawImportId]);

    // Get dry run preview
    const getDryRun = useCallback(async (): Promise<DryRunResponse> => {
        if (!state.rawImportId) {
            throw new Error('No file uploaded');
        }
        return getDryRunPreview(state.rawImportId);
    }, [state.rawImportId]);

    // Get available fields
    const getFields = useCallback(async (): Promise<AvailableField[]> => {
        return getAvailableFields();
    }, []);

    // Update mappings locally
    const updateMappings = useCallback((mappings: ColumnMapping[]) => {
        setState(prev => ({ ...prev, mappings }));
    }, []);

    // Reset state
    const reset = useCallback(() => {
        setState(initialState);
    }, []);

    return {
        ...state,
        upload,
        process,
        getMappings,
        confirm,
        getPreview,
        getDryRun,
        getFields,
        updateMappings,
        reset,
    };
}

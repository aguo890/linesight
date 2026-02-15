/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Ingestion API Client.
 * 
 * Handles HITL (Human-in-the-Loop) data ingestion flow:
 * - File upload
 * - Waterfall matching processing
 * - Mapping confirmation with learning
 */
import api from './api';

// Import types from centralized types file
import type {
    ColumnMapping,
    ProcessingStats,
    DataSource,
    UploadResponse,
    ProcessingResponse,
    AvailableField,
    ColumnMappingConfirmation,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    FilePreview,
    DryRunRecord,
    DryRunResponse,
    AILayoutAnalysisResponse,
    AIPreviewResponse,
} from '@/types/ingestion';

// Re-export all types for backward compatibility
export type {
    ColumnMapping,
    ProcessingStats,
    DataSource,
    UploadResponse,
    ProcessingResponse,
    AvailableField,
    ColumnMappingConfirmation,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    FilePreview,
    DryRunRecord,
    DryRunResponse,
    AILayoutAnalysisResponse,
    AIPreviewResponse,
};


// ============================================================================
// API Functions
// ============================================================================

/**
 * Upload a file for ingestion.
 * 
 * @param file - The file to upload (Excel or CSV)
 * @param factoryId - Optional factory ID for scoped matching
 * @returns Upload response with raw_import_id
 */
export async function uploadFileForIngestion(
    file: File,
    factoryId?: string,
    dataSourceId?: string
): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    if (factoryId) {
        params.append('factory_id', factoryId);
    }
    if (dataSourceId) {
        params.append('data_source_id', dataSourceId);
    }

    const response = await api.post<UploadResponse>(
        `/ingestion/upload?${params.toString()}`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );

    return response.data;
}

/**
 * Process a file through the Hybrid Waterfall Matching Engine.
 * 
 * @param rawImportId - ID from upload response
 * @param options - Processing options
 * @returns Processing response with column mappings
 */
export async function processFile(
    rawImportId: string,
    options?: {
        factoryId?: string;
        llmEnabled?: boolean;
    }
): Promise<ProcessingResponse> {
    const params = new URLSearchParams();
    if (options?.factoryId) {
        params.append('factory_id', options.factoryId);
    }
    if (options?.llmEnabled !== undefined) {
        params.append('llm_enabled', String(options.llmEnabled));
    }

    const response = await api.post<ProcessingResponse>(
        `/ingestion/process/${rawImportId}?${params.toString()}`
    );

    return response.data;
}

/**
 * Retrieves the current mapping state for a file without re-running the matching engine.
 * Used when a user returns to a partially configured or already processed upload.
 * 
 * @param rawImportId - ID from upload response
 * @returns Processing response with current mappings
 */
export async function getMappingState(
    rawImportId: string
): Promise<ProcessingResponse> {
    const response = await api.get<ProcessingResponse>(
        `/ingestion/mapping-state/${rawImportId}`
    );

    return response.data;
}

/**
 * Confirm column mappings after user review.
 * 
 * @param request - Confirmation request with mappings
 * @returns Confirmation response
 */
export async function confirmMapping(
    request: ConfirmMappingRequest
): Promise<ConfirmMappingResponse> {
    const response = await api.post<ConfirmMappingResponse>(
        '/ingestion/confirm-mapping',
        request
    );

    return response.data;
}

/**
 * Get list of available canonical fields for dropdown.
 * Caches the result to prevent redundant calls.
 * 
 * @returns List of available fields
 */
let fieldsCache: AvailableField[] | null = null;
let fieldsPromise: Promise<AvailableField[]> | null = null;

export async function getAvailableFields(forceRefresh = false): Promise<AvailableField[]> {
    if (fieldsCache && !forceRefresh) {
        return fieldsCache;
    }

    if (fieldsPromise && !forceRefresh) {
        return fieldsPromise;
    }

    fieldsPromise = api.get<AvailableField[]>('/ingestion/fields')
        .then(response => {
            fieldsCache = response.data;
            fieldsPromise = null;
            return response.data;
        })
        .catch(err => {
            fieldsPromise = null;
            throw err;
        });

    return fieldsPromise;
}

/**
 * Get file preview data.
 * 
 * @param rawImportId - ID from upload response
 * @returns File preview with headers and sample rows
 */
export async function getFilePreview(rawImportId: string): Promise<FilePreview> {
    const response = await api.get<FilePreview>(`/ingestion/preview/${rawImportId}`);
    return response.data;
}

/**
 * Get dry run preview of data import.
 * Shows before/after comparison for first 20 rows.
 * 
 * @param rawImportId - ID from upload response
 * @returns Dry run response with before/after data and warnings
 */
export async function getDryRunPreview(rawImportId: string): Promise<DryRunResponse> {
    const response = await api.get<DryRunResponse>(
        `/ingestion/preview-dry-run/${rawImportId}`
    );
    return response.data;
}


/**
 * Promote confirmed data to production.
 * 
 * @param rawImportId - ID of confirmed import
 * @returns Result with records processed count
 */
export async function promoteToProduction(rawImportId: string): Promise<any> {
    const response = await api.post<any>(`/ingestion/promote/${rawImportId}`);
    return response.data;
}

// ============================================================================
// AI-Powered Layout Analysis Functions
// ============================================================================

/**
 * Analyze file layout using AI (DeepSeek LLM).
 * For complex Excel files the standard matching engine can't handle.
 * 
 * WARNING: May take 10-40 seconds due to LLM processing.
 * 
 * @param rawImportId - ID from upload response
 * @param factoryName - Factory name for LLM context
 * @returns AI layout analysis with detected structure
 */
export async function analyzeLayoutWithAI(
    rawImportId: string,
    factoryName: string = 'Unknown Factory'
): Promise<AILayoutAnalysisResponse> {
    const response = await api.post<AILayoutAnalysisResponse>(
        `/ingestion/analyze-layout/${rawImportId}`,
        null,
        { params: { factory_name: factoryName } }
    );
    return response.data;
}

/**
 * Get preview using AI-generated extraction config.
 * Requires analyze-layout to have been called first.
 * 
 * @param rawImportId - ID from upload response
 * @param factoryId - Factory UUID for record attribution
 * @returns Normalized preview records
 */
export async function getAIPreview(
    rawImportId: string,
    factoryId: string
): Promise<AIPreviewResponse> {
    const response = await api.post<AIPreviewResponse>(
        `/ingestion/preview-ai/${rawImportId}`,
        null,
        { params: { factory_id: factoryId } }
    );
    return response.data;
}

/**
 * Fetch ALL uploaded files for a specific production line.
 * Returns both complete (has DataSource) and incomplete (pending setup) files.
 */
export async function getDataSourcesForLine(lineId: string): Promise<DataSource[]> {
    try {
        // Fetch uploads filtered by line_id, ordered by date
        const uploadsResponse = await api.get<any>(`/ingestion/uploads`, {
            params: {
                production_line_id: lineId,
                status: 'active', // Ensure we only get processed/active files
                limit: 50        // legitimate limit for UI
            }
        });

        // Map response to DataSource interface with explicit status
        return (uploadsResponse.data.files || []).map((file: any) => {
            const dsId = file.data_source_id;
            const isComplete = !!dsId;

            return {
                // CRITICAL: Only return DataSource ID if one exists - DO NOT FALLBACK
                id: dsId || null,
                // Always include the raw import ID for reference/continuation
                raw_import_id: file.id,
                filename: file.original_filename,
                uploaded_at: file.created_at,
                row_count: file.row_count || 0,
                // Explicitly tell the UI the state
                ingestion_status: isComplete ? 'complete' : 'incomplete',
                status: 'active',
                production_line_id: lineId,
                factory_id: file.factory_id
            } as DataSource;
        });
    } catch (error) {
        console.warn('Failed to fetch data sources for line:', error);
        return [];
    }
}

/**
 * Fetch the latest active data source for a specific production line.
 * Used to allow users to create dashboards from existing data.
 * Only returns if a COMPLETE data source exists.
 */
export async function getLatestDataSourceForLine(lineId: string): Promise<DataSource | null> {
    try {
        // 1. Get DataSource definition
        const dsResponse = await api.get<any>(`/data-sources/line/${lineId}`);
        const ds = dsResponse.data;
        if (!ds) return null;

        // 2. Get latest upload for metadata (filename, rows)
        const uploadsResponse = await api.get<any>(`/ingestion/uploads?production_line_id=${lineId}&limit=1`);
        const latestUpload = uploadsResponse.data.files?.[0];

        return {
            id: ds.id,
            raw_import_id: latestUpload?.id || '',
            filename: latestUpload?.original_filename || ds.source_name,
            uploaded_at: latestUpload?.created_at || ds.created_at,
            row_count: latestUpload?.row_count || 0,
            ingestion_status: 'complete', // This function only returns complete sources
            status: ds.is_active ? 'active' : 'archived',
            production_line_id: ds.production_line_id,
            factory_id: latestUpload?.factory_id
        };
    } catch (error) {
        console.warn('Failed to fetch data source for line:', error);
        return null; // Return null if not found (404) or other error
    }
}

/**
 * Fetch the schema/mappings for an existing data source.
 * This is needed to populate the "Available Columns" in the Widget Configuration step
 * when skipping the Mapping Validation step.
 */
export async function getDataSourceSchema(dataSourceId: string): Promise<ColumnMapping[]> {
    if (!dataSourceId) return [];

    try {
        const response = await api.get<any>(`/data-sources/${dataSourceId}`);
        const ds = response.data;

        if (!ds) {
            console.warn(`Data source ${dataSourceId} returned empty.`);
            return [];
        }

        // Find active mapping
        const activeMapping = ds.schema_mappings?.find((m: any) => m.is_active);

        if (!activeMapping || !activeMapping.column_map) {
            console.warn(`No active mapping found for data source ${dataSourceId}.`);
            return [];
        }

        // Check if it's already an object before parsing
        const rawColumnMap = activeMapping.column_map;
        const columnMap = typeof rawColumnMap === 'string' ? JSON.parse(rawColumnMap) : rawColumnMap;

        // Convert confirmed schema to ColumnMapping format for compatibility with the Wizard state
        return Object.entries(columnMap).map(([source, target]) => ({
            source_column: source,
            target_field: target as string,
            confidence: 1.0,
            tier: 'manual', // Treated as manually confirmed
            sample_data: [],
            needs_review: false,
            ignored: false,
            status: 'auto_mapped'
        }));
    } catch (error) {
        console.error('Failed to fetch schema:', error);
        return [];
    }
}

// ============================================================================
// React Query Hooks (if using React Query)

// ============================================================================

// These can be used with React Query for caching and auto-refetching
export const ingestionKeys = {
    all: ['ingestion'] as const,
    fields: () => [...ingestionKeys.all, 'fields'] as const,
    preview: (id: string) => [...ingestionKeys.all, 'preview', id] as const,
    processing: (id: string) => [...ingestionKeys.all, 'processing', id] as const,
};

export default {
    uploadFileForIngestion,
    processFile,
    confirmMapping,
    promoteToProduction,
    getAvailableFields,
    getFilePreview,
    getDryRunPreview,
    getLatestDataSourceForLine,
    getDataSourcesForLine,
    getDataSourceSchema,
    getMappingState,
    analyzeLayoutWithAI,
    getAIPreview,
    ingestionKeys,
};


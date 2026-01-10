/**
 * Ingestion Types
 * 
 * Centralized type definitions for the HITL (Human-in-the-Loop) 
 * data ingestion flow including upload, processing, and mapping.
 */

// =============================================================================
// Matching Tier Types
// =============================================================================

/** Matching engine tier that produced the column mapping */
export type MatchingTier = 'hash' | 'fuzzy' | 'llm' | 'unmatched' | 'manual';

/** Status of a column mapping after processing */
export type MappingStatus = 'auto_mapped' | 'needs_review' | 'needs_attention';

/** Status of a data source */
export type DataSourceStatus = 'active' | 'processing' | 'archived' | 'error';

/** Status of a dry run record validation */
export type DryRunRecordStatus = 'valid' | 'warning' | 'error';

/** Overall status of a dry run preview */
export type DryRunOverallStatus = 'ready' | 'needs_review';

// =============================================================================
// Column Mapping Types
// =============================================================================

/**
 * Represents a single column mapping from source to target field.
 * Used in the mapping review step of the ingestion wizard.
 */
export interface ColumnMapping {
    /** Original column name from uploaded file */
    source_column: string;
    /** Canonical field name this column maps to, or null if unmapped */
    target_field: string | null;
    /** Confidence score of the match (0.0 to 1.0) */
    confidence: number;
    /** Which tier of the matching engine produced this match */
    tier: MatchingTier;
    /** Fuzzy matching score if applicable */
    fuzzy_score?: number;
    /** LLM reasoning if applicable */
    reasoning?: string;
    /** Sample values from this column */
    sample_data: unknown[];
    /** Whether this mapping requires user review */
    needs_review: boolean;
    /** Whether this column should be ignored during import */
    ignored: boolean;
    /** Current status of this mapping */
    status: MappingStatus;
}

/**
 * Statistics from the matching engine processing.
 */
export interface ProcessingStats {
    hash_matches: number;
    fuzzy_matches: number;
    llm_matches: number;
    unmatched: number;
    total_columns: number;
    hash_percent: number;
    fuzzy_percent: number;
    llm_percent: number;
    unmatched_percent: number;
}

/**
 * User confirmation for a single column mapping.
 */
export interface ColumnMappingConfirmation {
    source_column: string;
    target_field: string | null;
    ignored: boolean;
    user_corrected: boolean;
}

// =============================================================================
// Data Source Types
// =============================================================================

/**
 * Represents an uploaded data source (Excel/CSV file).
 * 
 * IMPORTANT: Files go through a HITL flow:
 * 1. Upload → Creates RawImport (raw_import_id)
 * 2. Process → Generates column mappings
 * 3. Confirm → Creates DataSource (id) and SchemaMapping
 * 
 * Files that haven't completed step 3 will have id: null
 */
export interface DataSource {
    /** DataSource ID - NULL if file hasn't been confirmed yet */
    id: string | null;
    /** RawImport ID - always present, identifies the uploaded file */
    raw_import_id: string;
    filename: string;
    uploaded_at: string;
    row_count: number;
    /** Current status in the HITL flow */
    ingestion_status: 'complete' | 'incomplete';
    status: DataSourceStatus;
    production_line_id?: string;
    factory_id?: string;
}

/**
 * Available canonical field for mapping dropdown.
 */
export interface AvailableField {
    field: string;
    description: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Response from file upload endpoint.
 */
export interface UploadResponse {
    raw_import_id: string;
    filename: string;
    columns: number;
    rows: number;
    status: string;
    already_exists?: boolean;
}

/**
 * Response from file processing endpoint.
 */
export interface ProcessingResponse {
    raw_import_id: string;
    filename: string;
    columns: ColumnMapping[];
    stats: ProcessingStats;
    auto_mapped_count: number;
    needs_review_count: number;
    needs_attention_count: number;
}

/**
 * Request to confirm column mappings.
 */
export interface ConfirmMappingRequest {
    raw_import_id: string;
    mappings: ColumnMappingConfirmation[];
    /** Required: column containing date/time values */
    time_column: string;
    time_format?: string | null;
    data_source_id?: string;
    factory_id?: string;
    production_line_id?: string;
    learn_corrections?: boolean;
}

/**
 * Response from mapping confirmation.
 */
export interface ConfirmMappingResponse {
    schema_mapping_id: string;
    data_source_id: string;
    learned_aliases: number;
    message: string;
}

/**
 * File preview data with headers and sample rows.
 */
export interface FilePreview {
    raw_import_id: string;
    filename: string;
    headers: string[];
    sample_rows: unknown[][];
    total_rows: number;
    total_columns: number;
    status: string;
}

// =============================================================================
// Dry Run Preview Types
// =============================================================================

/**
 * A single record from dry run preview with validation status.
 */
export interface DryRunRecord {
    row_index?: number | null; // Optional: backend may not always provide this, or may return null
    raw_data: Record<string, unknown>;
    cleaned_data: Record<string, unknown>;
    status: DryRunRecordStatus;
    issues: string[];
}

/**
 * Response from dry run preview endpoint.
 */
export interface DryRunResponse {
    raw_import_id: string;
    total_rows: number;
    preview_records: DryRunRecord[];
    column_mapping_used: Record<string, string>;
    overall_status: DryRunOverallStatus;
}

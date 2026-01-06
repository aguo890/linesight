// Shared TypeScript types for LineSight

// Re-export ingestion types
export * from './ingestion';

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ApiError {
    detail: string;
    error_code?: string;
    context?: Record<string, unknown>;
}

// =============================================================================
// User Types
// =============================================================================

export type UserRole = 'admin' | 'manager' | 'analyst' | 'viewer';

export interface User {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    organization_id: string;
    is_active: boolean;
    is_verified: boolean;
    last_login: string | null;
    created_at: string;
    updated_at: string;
}

export interface Organization {
    id: string;
    name: string;
    code: string | null;
    subscription_tier: 'starter' | 'pro' | 'enterprise';
    created_at: string;
    updated_at: string;
}

// =============================================================================
// Factory Types
// =============================================================================

// =============================================================================
// Factory Types
// =============================================================================

export interface ShiftConfig {
    name: string;
    start_time: string;
    end_time: string;
}

export interface FactorySettings {
    // Defaults
    default_shift_pattern?: ShiftConfig[];
    standard_non_working_days?: number[];

    // Localization
    timezone?: string;
    date_format?: string;
    number_format?: string;
    measurement_system?: 'metric' | 'imperial';
    fiscal_year_start_month?: number;

    [key: string]: any;
}

export interface ProductionLineSettings {
    is_custom_schedule: boolean;
    shift_pattern?: ShiftConfig[];
    non_working_days?: number[];
    [key: string]: any;
}

export interface Factory {
    id: string;
    organization_id: string;
    name: string;
    code: string | null;
    location: string | null;
    country: string | null;
    timezone: string | null;

    // Settings
    settings?: FactorySettings;

    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProductionLine {
    id: string;
    factory_id: string;
    name: string;
    code: string | null;
    specialization: string | null;
    target_operators: number | null;
    daily_capacity_minutes: number | null;

    // Settings
    settings?: ProductionLineSettings;

    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// =============================================================================
// Upload Types
// =============================================================================

export type FileType = 'production' | 'quality' | 'cutting' | 'attendance' | 'unknown';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Upload {
    id: string;
    original_filename: string;
    file_type: FileType | null;
    file_size_bytes: number | null;
    status: ProcessingStatus;
    created_at: string;
}

export interface ProcessingJob {
    id: string;
    excel_upload_id: string;
    status: ProcessingStatus;
    inferred_schema: Record<string, unknown> | null;
    confidence_score: number | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface DashboardWidget {
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { w: number; h: number };
}

export interface DashboardLayout {
    widgets: DashboardWidget[];
}

import api from './api';

export interface DataSource {
    id: string;
    factory_id: string;
    name: string;
    code: string;
    description?: string;
    specialty?: string;
    source_name?: string;
    is_active: boolean;
    has_active_schema?: boolean; // True if DataSource has a confirmed schema mapping
}

export interface ShiftConfig {
    name: string;
    start_time: string;
    end_time: string;
}

export interface FactorySettings {
    default_shift_pattern?: ShiftConfig[];
    standard_non_working_days?: number[];

    // Localization
    timezone?: string;
    date_format?: string;
    number_format?: string;
    measurement_system?: 'metric' | 'imperial';
    fiscal_year_start_month?: number;

    // Legacy fallbacks (optional)
    operating_shifts?: ShiftConfig[];
    weekend_days?: number[];
    default_currency?: string;
    country?: string; // Sometimes tucked here
    [key: string]: any;
}

export interface Factory {
    id: string;
    organization_id: string;
    name: string;
    code?: string;
    city?: string;
    country?: string;
    timezone?: string; // Standard IANA timezone (e.g. Asia/Ho_Chi_Minh)
    locale?: string;   // Display locale (e.g. vi-VN)
    data_sources?: DataSource[];
    lineCount?: number; // Enriched in UI for display purposes
    settings?: FactorySettings;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export const listFactories = async (): Promise<Factory[]> => {
    const response = await api.get('/factories/');
    return response.data;
};

export const getFactory = async (id: string): Promise<Factory> => {
    const response = await api.get(`/factories/${id}`);
    return response.data;
};

export const listDataSources = async (factoryId: string): Promise<DataSource[]> => {
    const response = await api.get(`/factories/${factoryId}/data-sources`);
    return response.data;
};

export const resetSystemState = async (): Promise<{ status: string; message: string }> => {
    const response = await api.delete('/dev/reset-state');
    return response.data;
};

export const createFactory = async (data: { name: string; code?: string; location?: string; country?: string; timezone?: string }): Promise<Factory> => {
    const response = await api.post('/factories/', data);
    return response.data;
};

export const updateFactory = async (factoryId: string, data: { name?: string; code?: string; settings?: any }): Promise<Factory> => {
    const response = await api.patch(`/factories/${factoryId}`, data);
    return response.data;
};

// Adapted to use data-sources endpoint, mapping older "ProductionLine" params to new schema if needed
export const createDataSource = async (factoryId: string, data: { name: string; code?: string; description?: string; specialty?: string; settings?: any }): Promise<DataSource> => {
    // Backend expects specific fields. 'name' replaces 'source_name'? Or 'source_name' is required?
    // The previous analysis showed backend requires `source_name`.
    const payload = {
        ...data,
        source_name: data.name, // Ensure source_name is populated
        production_line_id: "legacy_compat", // If schema still demands it
    };
    const response = await api.post(`/factories/${factoryId}/data-sources`, payload);
    return response.data;
};

export const deleteFactory = async (factoryId: string): Promise<void> => {
    await api.delete(`/factories/${factoryId}`);
};

export const getDataSource = async (dsId: string): Promise<DataSource> => {
    const response = await api.get<DataSource>(`/factories/data-sources/${dsId}`);
    return response.data;
};

// Legacy compatibility: "ProductionLine" concept now maps to DataSource
// This function is used by dashboard pages to resolve factory_id from a production_line_id
export interface ProductionLine {
    id: string;
    factory_id: string;
    name: string;
    code?: string;
    is_active: boolean;
}

export const getProductionLine = async (lineId: string): Promise<ProductionLine> => {
    // The production_line_id stored in DataSource actually refers to a DataSource ID
    // in the current schema. We fetch the DataSource and map it to ProductionLine interface.
    const response = await api.get<DataSource>(`/factories/data-sources/${lineId}`);
    const ds = response.data;
    return {
        id: ds.id,
        factory_id: ds.factory_id,
        name: ds.name,
        code: ds.code,
        is_active: ds.is_active
    };
};

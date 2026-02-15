/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */


import api from './api';

export interface SchemaMapping {
    id: string;
    version: number;
    is_active: boolean;
    column_map: Record<string, any>; // JSON object (matches backend)
    extraction_rules?: Record<string, any>; // JSON object (matches backend)
    reviewed_by_user: boolean;
    user_notes?: string;
    created_at: string;
}

export interface AvailableField {
    field: string;
    description: string;
}

export interface DataSource {
    id: string;
    production_line_id: string;
    source_name: string;
    description?: string;
    time_column?: string;
    time_format?: string;
    is_active: boolean;
    schema_mappings: SchemaMapping[];
    created_at: string;
}


export interface SchemaMappingCreate {
    column_map: Record<string, string>;
    extraction_rules?: Record<string, any>;
    reviewed_by_user?: boolean;
    user_notes?: string;
}

export interface RawImport {
    id: string;
    original_filename: string;
    file_type: string;
    file_size_bytes: number;
    row_count: number;
    status: 'uploaded' | 'processing' | 'processed' | 'confirmed' | 'failed';
    created_at: string;
    factory_id: string;
    production_line_id: string;
}

export const listDataSources = async (skip: number = 0, limit: number = 100): Promise<DataSource[]> => {
    const response = await api.get(`/data-sources?skip=${skip}&limit=${limit}`);
    return response.data;
};

export const getDataSource = async (id: string): Promise<DataSource> => {
    const response = await api.get(`/data-sources/${id}`);
    return response.data;
};

export const getDataSourceByLine = async (lineId: string): Promise<DataSource | null> => {
    const response = await api.get(`/data-sources/by-line/${lineId}`);
    return response.data;
};

export const updateSchemaMapping = async (dataSourceId: string, data: SchemaMappingCreate): Promise<SchemaMapping> => {
    const response = await api.put(`/data-sources/${dataSourceId}/mapping`, data);
    return response.data;
};

export const updateDataSource = async (
    id: string,
    updates: Partial<Pick<DataSource, 'time_column' | 'time_format' | 'description' | 'source_name' | 'is_active'>>
): Promise<DataSource> => {
    const response = await api.put(`/data-sources/${id}`, updates);
    return response.data;
};

export const getUploadHistory = async (lineId: string): Promise<RawImport[]> => {
    const response = await api.get(`/ingestion/uploads`, {
        params: { production_line_id: lineId }
    });
    return response.data.files;
};

export const getAvailableFields = async (): Promise<AvailableField[]> => {
    const response = await api.get<AvailableField[]>('/ingestion/fields');
    return response.data;
};


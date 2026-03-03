/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */


import api from './api';

import {
    type DataSourceRead,
    type AppSchemasDatasourceDataSourceUpdate as DataSourceUpdate,
    type SchemaMappingResponse,
    type SchemaMappingCreate
} from '@/api/model';

/**
 * Stable frontend contract for DataSource, decoupled from backend schema.
 */
export interface ClientDataSource {
    id: string;
    factoryId: string;
    sourceName: string;
    name: string;
    code: string;
    description: string;
    timeColumn: string;
    isActive: boolean;
    schemaMappings: SchemaMappingResponse[];
    hasActiveSchema: boolean;
    createdAt: string;
    isMockedFallback: boolean;
}

/**
 * Adapter function to map backend DataSourceRead to ClientDataSource.
 */
export const adaptDataSourceToClient = (data: DataSourceRead | null | undefined): ClientDataSource => {
    if (!data) {
        return {
            id: '',
            factoryId: '',
            sourceName: 'Unknown',
            name: 'Unknown',
            code: '',
            description: '',
            timeColumn: '',
            isActive: false,
            schemaMappings: [],
            hasActiveSchema: false,
            createdAt: new Date().toISOString(),
            isMockedFallback: true
        };
    }

    // Flag as mock if critical identification fields are missing
    const isMockedFallback = !data.id || (!data.source_name && !data.name);

    return {
        id: data.id || `mock-${Date.now()}`,
        factoryId: data.factory_id || (data as any).production_line_id || '',
        sourceName: data.source_name || data.name || 'Unnamed Source',
        name: data.name || data.source_name || 'Unnamed Source',
        code: (data as any).code || '',
        description: data.description || '',
        timeColumn: data.time_column || '',
        isActive: data.is_active ?? false,
        schemaMappings: data.schema_mappings || [],
        hasActiveSchema: (data.schema_mappings || []).some(m => m.is_active),
        createdAt: data.created_at || new Date().toISOString(),
        isMockedFallback
    };
};

export interface AvailableField {
    field: string;
    description: string;
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

export const listDataSources = async (skip: number = 0, limit: number = 100): Promise<ClientDataSource[]> => {
    const response = await api.get(`/data-sources?skip=${skip}&limit=${limit}`);
    return (response.data || []).map((ds: DataSourceRead) => adaptDataSourceToClient(ds));
};

export const getDataSource = async (id: string): Promise<ClientDataSource> => {
    const response = await api.get(`/data-sources/${id}`);
    return adaptDataSourceToClient(response.data);
};

export const getDataSourceByLine = async (lineId: string): Promise<ClientDataSource | null> => {
    const response = await api.get(`/data-sources/by-line/${lineId}`);
    if (!response.data) return null;
    return adaptDataSourceToClient(response.data);
};

export const updateSchemaMapping = async (dataSourceId: string, data: SchemaMappingCreate): Promise<SchemaMappingResponse> => {
    const response = await api.put(`/data-sources/${dataSourceId}/mapping`, data);
    return response.data;
};

export const updateDataSource = async (
    id: string,
    updates: DataSourceUpdate
): Promise<ClientDataSource> => {
    const response = await api.put(`/data-sources/${id}`, updates);
    return adaptDataSourceToClient(response.data);
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


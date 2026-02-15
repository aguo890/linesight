/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import api from '@/lib/api';

// Types
export interface LineDataSource {
    id: string;
    production_line_id: string;
    source_name: string;
    description?: string;
    is_active: boolean;
    time_column: string;
    time_format?: string;
    created_at: string;
    updated_at: string;
    schema_mappings: SchemaMapping[];
}

export interface SchemaMapping {
    id: string;
    version: number;
    is_active: boolean;
    column_map: string; // JSON string
    reviewed_by_user: boolean;
    created_at: string;
}

export interface UploadRecord {
    id: string;
    original_filename: string;
    file_type: string;
    file_size_bytes: number;
    status: string;
    created_at: string;
    factory_id: string;
    production_line_id: string;
}

export interface UploadsListResponse {
    files: UploadRecord[];
    total: number;
    offset: number;
    limit: number;
}

// API Functions

export const getDataSource = async (lineId: string): Promise<LineDataSource> => {
    const response = await api.get<LineDataSource>(`/data-sources/line/${lineId}`);
    return response.data;
};

export const deleteDataSource = async (dataSourceId: string): Promise<void> => {
    await api.delete(`/data-sources/${dataSourceId}`);
};

export const updateDataSource = async (dataSourceId: string, updates: { time_column?: string; is_active?: boolean }): Promise<LineDataSource> => {
    const response = await api.put<LineDataSource>(`/data-sources/${dataSourceId}`, updates);
    return response.data;
};

export const getUploads = async (lineId: string, limit = 50, offset = 0): Promise<UploadsListResponse> => {
    const response = await api.get<UploadsListResponse>('/ingestion/uploads', {
        params: { production_line_id: lineId, limit, offset }
    });
    return response.data;
};

export const deleteUploads = async (lineId: string): Promise<void> => {
    await api.delete('/ingestion/uploads', {
        params: { production_line_id: lineId }
    });
};

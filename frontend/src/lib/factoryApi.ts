/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import api from './api';

import {
    type FactoryRead,
    type DataSourceRead
} from '../api/model';

export const listFactories = async (): Promise<FactoryRead[]> => {
    const response = await api.get('/factories/');
    return response.data;
};

export const getFactory = async (id: string): Promise<FactoryRead> => {
    const response = await api.get(`/factories/${id}`);
    return response.data;
};

export const listDataSources = async (factoryId: string): Promise<DataSourceRead[]> => {
    const response = await api.get(`/factories/${factoryId}/data-sources`);
    return response.data;
};

export const resetSystemState = async (): Promise<{ status: string; message: string }> => {
    const response = await api.delete('/dev/reset-state');
    return response.data;
};

export const createFactory = async (data: { name: string; code?: string; location?: string; country?: string; timezone?: string }): Promise<FactoryRead> => {
    const response = await api.post('/factories/', data);
    return response.data;
};

export const updateFactory = async (factoryId: string, data: { name?: string; code?: string; settings?: any }): Promise<FactoryRead> => {
    const response = await api.patch(`/factories/${factoryId}`, data);
    return response.data;
};

// Adapted to use data-sources endpoint, mapping older "ProductionLine" params to new schema if needed
export const createDataSource = async (factoryId: string, data: { name: string; code?: string; description?: string; specialty?: string; settings?: any }): Promise<DataSourceRead> => {
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

export const getDataSource = async (dsId: string): Promise<DataSourceRead> => {
    const response = await api.get<DataSourceRead>(`/factories/data-sources/${dsId}`);
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
    const response = await api.get<DataSourceRead>(`/factories/data-sources/${lineId}`);
    const ds = response.data;
    return {
        id: ds.id,
        factory_id: ds.factory_id,
        name: ds.name,
        code: ds.code ?? undefined,
        is_active: ds.is_active
    };
};

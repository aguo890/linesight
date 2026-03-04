/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import api from './api';

import {
    type FactoryRead,
    type DataSourceRead
} from '@/api/model';
import {
    type ClientDataSource,
    adaptDataSourceToClient
} from './datasourceApi';

/**
 * Stable frontend contract for Factory, decoupled from backend schema.
 */
export interface ClientFactory {
    id: string;
    name: string;
    code: string;
    location: string;
    city: string;
    country: string;
    timezone: string;
    isActive: boolean;
    settings: any;
    organizationId: string;
    locale: string;
    isMockedFallback: boolean;
    dataSources?: ClientDataSource[]; // Enriched in UI or some endpoints
}

/**
 * Adapter function to map backend FactoryRead to ClientFactory.
 */
export const adaptFactoryToClient = (data: FactoryRead | null | undefined): ClientFactory => {
    if (!data) {
        return {
            id: '',
            name: 'Unknown Factory',
            code: '',
            location: '',
            city: '',
            country: '',
            timezone: 'UTC',
            isActive: false,
            settings: {},
            organizationId: '',
            locale: 'en-US',
            isMockedFallback: true
        };
    }

    // Flag as mock if critical identification fields are missing
    const isMockedFallback = !data.id || !data.name;

    return {
        id: data.id || `mock-${Date.now()}`,
        name: data.name || 'Unnamed Factory',
        code: data.code || '',
        location: (data as any).location || '',
        city: (data as any).city || '',
        country: (data as any).country || '',
        timezone: (data as any).timezone || 'UTC',
        isActive: (data as any).is_active ?? true,
        settings: data.settings || {},
        organizationId: data.organization_id || '',
        locale: (data as any).locale || 'en-US',
        isMockedFallback
    };
};

export const listFactories = async (): Promise<ClientFactory[]> => {
    const response = await api.get('/factories/');
    return (response.data || []).map((f: FactoryRead) => adaptFactoryToClient(f));
};

export const getFactory = async (id: string): Promise<ClientFactory> => {
    const response = await api.get(`/factories/${id}`);
    return adaptFactoryToClient(response.data);
};

export const listDataSources = async (factoryId: string): Promise<ClientDataSource[]> => {
    const response = await api.get(`/factories/${factoryId}/data-sources`);
    return (response.data || []).map((ds: DataSourceRead) => adaptDataSourceToClient(ds));
};

export const resetSystemState = async (): Promise<{ status: string; message: string }> => {
    const response = await api.delete('/dev/reset-state');
    return response.data;
};

export const createFactory = async (data: { name: string; code?: string; location?: string; country?: string; timezone?: string }): Promise<ClientFactory> => {
    const response = await api.post('/factories/', data);
    return adaptFactoryToClient(response.data);
};

export const updateFactory = async (factoryId: string, data: { name?: string; code?: string; settings?: any }): Promise<ClientFactory> => {
    const response = await api.patch(`/factories/${factoryId}`, data);
    return adaptFactoryToClient(response.data);
};

export const createDataSource = async (factoryId: string, data: { name: string; code?: string; description?: string; specialty?: string; settings?: any }): Promise<ClientDataSource> => {
    const payload = {
        ...data,
        source_name: data.name,
        production_line_id: "legacy_compat",
    };
    const response = await api.post(`/factories/${factoryId}/data-sources`, payload);
    return adaptDataSourceToClient(response.data);
};

export const deleteFactory = async (factoryId: string): Promise<void> => {
    await api.delete(`/factories/${factoryId}`);
};

export const getDataSourceById = async (dsId: string): Promise<ClientDataSource> => {
    const response = await api.get<DataSourceRead>(`/factories/data-sources/${dsId}`);
    return adaptDataSourceToClient(response.data);
};

// Legacy compatibility: "ProductionLine" concept now maps to DataSource
export interface ProductionLine {
    id: string;
    factory_id: string;
    name: string;
    code?: string;
    is_active: boolean;
}

export const getProductionLine = async (lineId: string): Promise<ProductionLine> => {
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

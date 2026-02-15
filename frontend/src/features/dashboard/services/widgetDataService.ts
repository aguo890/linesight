/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import api from '@/lib/api';
// Standardized Adapter Interface - kept for compatibility with registry for now, 
// but we will move towards the new fetch pattern
export interface DataAdapter {
    real?: (params: any) => Promise<any>;
    mock: (filters: any) => any | Promise<any>;
    transform?: (data: any) => any;
}

// 1. Generic Response Type
export type ServiceResponse<T> = {
    data: T;
    source: 'API' | 'MOCK';
};

// 2. The Fetcher Function
export const fetchWidgetData = async <T>(
    dataId: string, // Kept for logging/lookup
    endpoint: string | undefined,
    params: any,
    schema: z.ZodSchema<T> | undefined,
    mockDataGenerator: (filters: any) => T,
    mockFilters: any
): Promise<ServiceResponse<T>> => {
    // 1. Attempt Real Fetch
    if (endpoint) {
        try {
            console.log(`[DEBUG][${dataId}] 🌐 Fetching from: ${endpoint}`, { params });
            const response = await api.get(endpoint, { params });
            const rawData = response.data;

            // Diagnostic: Expose raw data to browser console
            console.log(`[DEBUG][${dataId}] 📦 Raw API Response:`, rawData);
            (window as any).DEBUG_WIDGET_DATA = (window as any).DEBUG_WIDGET_DATA || {};
            (window as any).DEBUG_WIDGET_DATA[dataId] = rawData;

            // Safety Check: Detect "Soft" 401s or Error Objects potentially returned as 200 OK
            // or if apiClient didn't reject on 401 (though it should).
            if (rawData && typeof rawData === 'object' && 'detail' in rawData) {
                throw new Error(`API Error: ${(rawData as any).detail}`);
            }

            // Diagnostic: Log if raw data is empty
            const isEmpty = Array.isArray(rawData) ? rawData.length === 0 :
                (rawData && typeof rawData === 'object' && Object.keys(rawData).length === 0);
            if (isEmpty) {
                console.warn(`[DEBUG][${dataId}] ⚠️ API returned EMPTY data. Falling back to mock.`);
            }

            // 3. Runtime Validation with detailed error logging
            let parsedData: T;
            try {
                parsedData = schema ? schema.parse(rawData) : (rawData as T);
            } catch (zodError: any) {
                console.error(`[DEBUG][${dataId}] ❌ ZOD VALIDATION FAILED:`, zodError?.errors || zodError);
                console.error(`[DEBUG][${dataId}] Schema Expected vs Received:`, {
                    schemaShape: (schema as any)?._def?.shape ? Object.keys((schema as any)._def.shape()) : 'unknown',
                    receivedKeys: rawData ? Object.keys(rawData) : 'null',
                    receivedData: rawData
                });
                throw zodError; // Re-throw to trigger fallback
            }

            return { data: parsedData, source: 'API' };
        } catch (error: any) {
            // Check for 404 - expected behavior for not-yet-implemented endpoints
            if (error?.response?.status === 404) {
                console.warn(`[DEBUG][${dataId}] ⚠️ 404 Not Found for ${endpoint}. Using mock.`);
            } else {
                console.error(`[DEBUG][${dataId}] ❌ FETCH/VALIDATION FAILED:`, {
                    endpoint,
                    params,
                    errorMessage: error?.message,
                    errorResponse: error?.response?.data,
                    status: error?.response?.status
                });
            }
            // Fall through to Mock Logic
        }
    } else {
        // No endpoint defined, treat as immediate "failure" of real data, go to mock
        console.warn(`[DEBUG][${dataId}] No endpoint defined, using mock.`);
    }

    // 2. Mock Fallback logic
    try {
        const rawMock = mockDataGenerator(mockFilters);

        // Sanity check for missing mocks
        if (rawMock === null || rawMock === undefined) {
            throw new Error(`No mock data available for ${dataId}`);
        }

        // 4. Validate Mock Data too (Ensures mocks never drift from schema)
        // Wrappped in try/catch to prevent white-screen of death if mock is bad
        try {
            const parsedMock = schema ? schema.parse(rawMock) : rawMock;
            return { data: parsedMock, source: 'MOCK' };
        } catch (zodError) {
            console.error(`[${dataId}] Mock Data Validation Failed (Schema Mismatch). Returning Safe Fallback.`);
            // Return "Safe Fallback" (e.g. valid empty state) 
            // We return a "valid" mock response but with empty/null data so the generic UI can handle it "gracefully" 
            // (e.g. simply showing "No Data" or an empty chart rather than crashing)
            // Ideally we'd return a default that matches the schema, but we can't generate that generically.
            // Casting as any/T to satisfy the type, assuming the component handles null/empty gracefully.
            return { data: [] as any, source: 'MOCK' };
        }

    } catch (mockError) {
        // This is a critical failure - neither API nor Mock worked.
        console.error(`[${dataId}] Critical: Mock Data Generation/Validation Failed.`, mockError);
        // Do NOT throw. Return empty object to prevent dashboard crash.
        return { data: [] as any, source: 'MOCK' };
    }
};

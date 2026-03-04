/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import {
    getDataSourceByLine,
    updateDataSource,
    getUploadHistory,
    type RawImport,
} from '@/lib/datasourceApi';


// Mock the api module
vi.mock('../api');

describe('datasourceApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getDataSourceByLine', () => {
        it('calls the correct endpoint and adapts data', async () => {
            const mockBackendData = {
                id: 'ds_123',
                factory_id: 'factory_456',
                source_name: 'Test Source',
                is_active: true,
                schema_mappings: [],
                created_at: '2024-01-01T00:00:00Z'
            };

            vi.mocked(api.get).mockResolvedValue({ data: mockBackendData });

            const result = await getDataSourceByLine('line_456');

            expect(api.get).toHaveBeenCalledWith('/data-sources/by-line/line_456');

            // Should be adapted to ClientDataSource
            expect(result).not.toBeNull();
            expect(result?.id).toBe('ds_123');
            expect(result?.sourceName).toBe('Test Source');
            expect(result?.isActive).toBe(true);
            expect(result?.isMockedFallback).toBe(false);
        });

        it('handles missing backend fields by flagging mock fallback', async () => {
            // Missing id and name
            const mockBackendData = {
                factory_id: 'factory_456',
                is_active: true
            };

            vi.mocked(api.get).mockResolvedValue({ data: mockBackendData });

            const result = await getDataSourceByLine('line_incomplete');

            expect(result?.isMockedFallback).toBe(true);
            expect(result?.sourceName).toBe('Unnamed Source');
        });

        it('handles null response (no config found)', async () => {
            vi.mocked(api.get).mockResolvedValue({ data: null });

            const result = await getDataSourceByLine('line_new');

            expect(api.get).toHaveBeenCalledWith('/data-sources/by-line/line_new');
            expect(result).toBeNull();
        });
    });

    describe('updateDataSource', () => {
        it('updates and adapts DataSource successfully', async () => {
            const mockBackendDataSource = {
                id: 'ds-123',
                factory_id: 'factory-123',
                source_name: 'Test Data Source',
                description: 'Updated description',
                time_column: 'NewColumn',
                is_active: true,
                schema_mappings: [],
                created_at: '2024-01-01T00:00:00Z',
            };

            vi.mocked(api.put).mockResolvedValueOnce({ data: mockBackendDataSource });

            const updates = {
                time_column: 'NewColumn',
                description: 'Updated description',
            };

            const result = await updateDataSource('ds-123', updates as any);

            expect(api.put).toHaveBeenCalledWith('/data-sources/ds-123', updates);
            expect(result.id).toBe('ds-123');
            expect(result.sourceName).toBe('Test Data Source');
            expect(result.timeColumn).toBe('NewColumn');
            expect(result.description).toBe('Updated description');
            expect(result.isMockedFallback).toBe(false);
        });
    });

    describe('getUploadHistory', () => {
        it('fetches upload history for line', async () => {
            const mockUploads: RawImport[] = [
                {
                    id: 'upload-1',
                    original_filename: 'data_jan.xlsx',
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    file_size_bytes: 1024,
                    row_count: 100,
                    status: 'processed',
                    created_at: '2024-01-15T10:00:00Z',
                    factory_id: 'factory-1',
                    production_line_id: 'line-789',
                },
            ];

            vi.mocked(api.get).mockResolvedValueOnce({ data: { files: mockUploads } });

            const result = await getUploadHistory('line-789');

            expect(api.get).toHaveBeenCalledWith('/ingestion/uploads', {
                params: { production_line_id: 'line-789' },
            });
            expect(result).toEqual(mockUploads);
        });
    });
});


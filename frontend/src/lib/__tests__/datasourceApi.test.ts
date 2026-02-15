/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../api';
import {
    getDataSourceByLine,
    updateDataSource,
    getUploadHistory,
    type DataSource,
    type RawImport,
} from '../datasourceApi';


// Mock the api module
vi.mock('../api');

describe('datasourceApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getDataSourceByLine', () => {
        it('calls the correct endpoint and returns data', async () => {
            const mockData = {
                id: 'ds_123',
                production_line_id: 'line_456',
                source_name: 'Test Source',
                is_active: true,
                schema_mappings: [],
                created_at: '2024-01-01T00:00:00Z'
            };

            vi.mocked(api.get).mockResolvedValue({ data: mockData });

            const result = await getDataSourceByLine('line_456');

            expect(api.get).toHaveBeenCalledWith('/data-sources/by-line/line_456');
            expect(result).toEqual(mockData);
        });

        it('handles null response (no config found)', async () => {
            vi.mocked(api.get).mockResolvedValue({ data: null });

            const result = await getDataSourceByLine('line_new');

            expect(api.get).toHaveBeenCalledWith('/data-sources/by-line/line_new');
            expect(result).toBeNull();
        });

        it('propagates API errors correctly', async () => {
            const error = new Error('Network error');
            vi.mocked(api.get).mockRejectedValue(error);

            await expect(getDataSourceByLine('line_error')).rejects.toThrow('Network error');
        });
    });

    describe('updateDataSource', () => {
        it('updates DataSource successfully', async () => {
            const mockUpdatedDataSource: DataSource = {
                id: 'ds-123',
                production_line_id: 'line-123',
                source_name: 'Test Data Source',
                description: 'Updated description',
                time_column: 'NewColumn',
                time_format: 'DD/MM/YYYY',
                is_active: true,
                schema_mappings: [],
                created_at: '2024-01-01T00:00:00Z',
            };

            vi.mocked(api.put).mockResolvedValueOnce({ data: mockUpdatedDataSource });

            const updates = {
                time_column: 'NewColumn',
                description: 'Updated description',
            };

            const result = await updateDataSource('ds-123', updates);

            expect(api.put).toHaveBeenCalledWith('/data-sources/ds-123', updates);
            expect(result).toEqual(mockUpdatedDataSource);
            expect(result.time_column).toBe('NewColumn');
            expect(result.description).toBe('Updated description');
        });

        it('handles partial updates', async () => {
            const mockDataSource: DataSource = {
                id: 'ds-456',
                production_line_id: 'line-456',
                source_name: 'Original Name',
                description: 'Original description',
                time_column: 'Date',
                is_active: true,
                schema_mappings: [],
                created_at: '2024-01-01T00:00:00Z',
            };

            vi.mocked(api.put).mockResolvedValueOnce({ data: mockDataSource });

            const updates = { time_column: 'NewDate' };
            const result = await updateDataSource('ds-456', updates);

            expect(api.put).toHaveBeenCalledWith('/data-sources/ds-456', updates);
            expect(result).toEqual(mockDataSource);
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
                {
                    id: 'upload-2',
                    original_filename: 'data_feb.xlsx',
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    file_size_bytes: 2048,
                    row_count: 200,
                    status: 'processed',
                    created_at: '2024-02-15T10:00:00Z',
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
            expect(result).toHaveLength(2);
            expect(result[0].original_filename).toBe('data_jan.xlsx');
        });

        it('returns empty array when no uploads found', async () => {
            vi.mocked(api.get).mockResolvedValueOnce({ data: { files: [] } });

            const result = await getUploadHistory('line-empty');

            expect(api.get).toHaveBeenCalledWith('/ingestion/uploads', {
                params: { production_line_id: 'line-empty' },
            });
            expect(result).toEqual([]);
        });

        it('handles API errors', async () => {
            const error = new Error('Server error');
            vi.mocked(api.get).mockRejectedValue(error);

            await expect(getUploadHistory('line-error')).rejects.toThrow('Server error');
        });
    });
});


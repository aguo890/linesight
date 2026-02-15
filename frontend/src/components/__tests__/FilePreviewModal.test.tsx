/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { FilePreviewModal } from '../FilePreviewModal';
import * as ingestionApi from '@/lib/ingestionApi';

// Mock the ingestionApi module
vi.mock('../../lib/ingestionApi', () => ({
    getFilePreview: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) => {
            const translations: Record<string, string> = {
                'file_preview.title': 'File Preview',
                'file_preview.loading': 'Loading preview...',
                'file_preview.error_title': 'Preview Error',
                'common.actions.close': 'Close',
                'file_preview.null_value': 'null'
            };
            if (key === 'file_preview.showing_rows') return `Showing first ${options?.count} rows`;
            if (key === 'file_preview.columns_detected') return `${options?.count} columns detected`;
            return translations[key] || key;
        },
    }),
}));

describe('FilePreview Modal Component', () => {
    const mockFileData = {
        raw_import_id: 'test-import-id',
        file_id: 'test-123',
        filename: 'test.xlsx',
        status: 'pending',
        uploaded_at: '2024-01-01',
        total_rows: 100,
        total_columns: 4,
        headers: ['Date', 'Line', 'Target', 'Actual'],
        sample_rows: [
            ['2024-12-20', 'Line 1', '1000', '950'],
            ['2024-12-21', 'Line 1', '1000', '1020'],
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={false}
                onClose={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders modal when isOpen is true', () => {
        vi.mocked(ingestionApi.getFilePreview).mockResolvedValue(mockFileData);

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText(/file preview/i)).toBeInTheDocument();
        expect(screen.getByText('test.xlsx')).toBeInTheDocument();
    });

    it('shows loading state while fetching preview', () => {
        vi.mocked(ingestionApi.getFilePreview).mockImplementation(
            () => new Promise(() => { }) // Never resolves
        );

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
    });

    it('displays preview data when loaded successfully', async () => {
        vi.mocked(ingestionApi.getFilePreview).mockResolvedValue(mockFileData);

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/showing first 2 rows/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/4 columns detected/i)).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Line')).toBeInTheDocument();
        expect(screen.getByText('2024-12-20')).toBeInTheDocument();
    });

    it('displays error message when preview fails', async () => {
        vi.mocked(ingestionApi.getFilePreview).mockRejectedValue({
            response: { data: { detail: 'File not found' } },
        });

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/preview error/i)).toBeInTheDocument();
            expect(screen.getByText(/file not found/i)).toBeInTheDocument();
        });
    });

    it('calls onClose when close button is clicked', async () => {
        vi.mocked(ingestionApi.getFilePreview).mockResolvedValue(mockFileData);
        const handleClose = vi.fn();

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={handleClose}
            />
        );

        // Wait for loading to finish and content to appear
        await waitFor(() => {
            // There are two buttons: one X icon (aria-label="Close") and one footer button (text "Close")
            // Use getAllByRole to ensure they exist
            expect(screen.getAllByRole('button', { name: /close/i }).length).toBeGreaterThan(0);
        });

        // Click the footer button by finding its text content
        // This distinguishes it from the X icon button which has no text content
        const closeButton = screen.getByText(/close|common\.actions\.close/i);
        closeButton.click();

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('shows Close button in footer when data is loaded', async () => {
        vi.mocked(ingestionApi.getFilePreview).mockResolvedValue(mockFileData);

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        await waitFor(() => {
            // Verify the footer button exists by its text
            expect(screen.getByText(/close|common\.actions\.close/i)).toBeInTheDocument();
        });
    });
});

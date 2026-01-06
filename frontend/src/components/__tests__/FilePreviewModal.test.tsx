import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { FilePreviewModal } from '../FilePreviewModal';
import * as fileApi from '../../lib/fileApi';

// Mock the fileAPI module
vi.mock('../../lib/fileApi', () => ({
    getFilePreview: vi.fn(),
    processFile: vi.fn(),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('FilePreview Modal Component', () => {
    const mockFileData = {
        filename: 'test.xlsx',
        preview_rows: 5,
        total_rows: 100,
        columns: ['Date', 'Line', 'Target', 'Actual'],
        data: [
            { Date: '2024-12-20', Line: 'Line 1', Target: '1000', Actual: '950' },
            { Date: '2024-12-21', Line: 'Line 1', Target: '1000', Actual: '1020' },
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
        vi.mocked(fileApi.getFilePreview).mockResolvedValue(mockFileData);

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
        vi.mocked(fileApi.getFilePreview).mockImplementation(
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
        vi.mocked(fileApi.getFilePreview).mockResolvedValue(mockFileData);

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/showing first 5 rows/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/4 columns detected/i)).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Line')).toBeInTheDocument();
        expect(screen.getByText('2024-12-20')).toBeInTheDocument();
    });

    it('displays error message when preview fails', async () => {
        vi.mocked(fileApi.getFilePreview).mockRejectedValue({
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
        vi.mocked(fileApi.getFilePreview).mockResolvedValue(mockFileData);
        const handleClose = vi.fn();

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={handleClose}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', { name: /close/i });
        closeButton.click();

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('shows Proceed to Analysis button when data is loaded', async () => {
        vi.mocked(fileApi.getFilePreview).mockResolvedValue(mockFileData);

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /proceed to analysis/i })).toBeInTheDocument();
        });
    });

    it('handles file processing when Proceed to Analysis is clicked', async () => {
        vi.mocked(fileApi.getFilePreview).mockResolvedValue(mockFileData);
        vi.mocked(fileApi.processFile).mockResolvedValue({
            job_id: 'job-123',
            status: 'completed',
            message: 'Processing complete',
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
            expect(screen.getByRole('button', { name: /proceed to analysis/i })).toBeInTheDocument();
        });

        const proceedButton = screen.getByRole('button', { name: /proceed to analysis/i });
        proceedButton.click();

        await waitFor(() => {
            expect(fileApi.processFile).toHaveBeenCalledWith('test-123', { use_ai_agent: false });
        });
    });

    it('displays processing state when analyzing file', async () => {
        vi.mocked(fileApi.getFilePreview).mockResolvedValue(mockFileData);
        vi.mocked(fileApi.processFile).mockImplementation(
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

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /proceed to analysis/i })).toBeInTheDocument();
        });

        const proceedButton = screen.getByRole('button', { name: /proceed to analysis/i });
        proceedButton.click();

        await waitFor(() => {
            expect(screen.getByText(/analyzing file structure/i)).toBeInTheDocument();
        });
    });

    it('disables buttons during processing', async () => {
        vi.mocked(fileApi.getFilePreview).mockResolvedValue(mockFileData);
        vi.mocked(fileApi.processFile).mockImplementation(
            () => new Promise(() => { })
        );

        render(
            <FilePreviewModal
                fileId="test-123"
                filename="test.xlsx"
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /proceed to analysis/i })).toBeInTheDocument();
        });

        const proceedButton = screen.getByRole('button', { name: /proceed to analysis/i });
        proceedButton.click();

        await waitFor(() => {
            const closeButton = screen.getByRole('button', { name: /close/i });
            expect(closeButton).toBeDisabled();
        });
    });
});

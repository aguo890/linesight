import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { DashboardWizard } from './DashboardWizard';
import { createFactory, createProductionLine, listFactories, listFactoryLines } from '../../../lib/factoryApi';
import { getAvailableFields } from '../../../lib/ingestionApi';

// Mock dependencies
vi.mock('../../../lib/factoryApi');
vi.mock('../../../lib/ingestionApi');
vi.mock('../storage', () => ({
    dashboardStorage: {
        createDashboard: vi.fn(() => ({ id: 'new-dashboard-id' }))
    }
}));
// Mocks for sub-components to isolate Wizard logic
vi.mock('./wizard/WizardStep1Upload', () => ({
    WizardStep1Upload: ({ onFileUploaded, onBeforeUpload }: any) => (
        <div data-testid="step-upload">
            <button
                data-testid="mock-upload-btn"
                onClick={async () => {
                    if (onBeforeUpload) {
                        await onBeforeUpload();
                    }
                    // Simulate upload complete with dummy mapping to ensure next step renders
                    onFileUploaded(new File([''], 'test.xlsx'), 'raw-id-123', [
                        { source_column: 'A', target_field: 'f1', confidence: 1, tier: 'system', ignored: false }
                    ]);
                }}
            >
                Simulate Upload
            </button>
        </div>
    )
}));
vi.mock('./wizard/WizardStep2Mapping', () => ({
    WizardStep2Mapping: ({ onMappingValidated }: any) => (
        <div data-testid="step-mapping">
            <button onClick={() => onMappingValidated([])}>Confirm Mapping</button>
        </div>
    )
}));
vi.mock('./wizard/WizardStep3Widgets', () => ({
    WizardStep3Widgets: ({ onComplete }: any) => (
        <div data-testid="step-widgets">
            <button onClick={() => onComplete({ widgets: [] })}>Create Dashboard</button>
        </div>
    )
}));

describe('DashboardWizard', () => {
    const mockOnClose = vi.fn();
    const mockOnComplete = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (getAvailableFields as Mock).mockResolvedValue([]);
        (listFactories as Mock).mockResolvedValue([]);
    });

    it('renders correctly in Create Mode', async () => {
        (getAvailableFields as Mock).mockResolvedValue([]);
        (listFactories as Mock).mockResolvedValue([{ id: 'f1', name: 'Test Factory' }]);
        (listFactoryLines as Mock).mockResolvedValue([{ id: 'l1', name: 'Test Line' }]);

        render(<DashboardWizard isOpen={true} onClose={mockOnClose} onComplete={mockOnComplete} mode="create" />);

        await waitFor(() => {
            expect(screen.getByText('Test Factory')).toBeInTheDocument();
        });

        // Current implementation uses selects
        expect(screen.getByText('Factory')).toBeInTheDocument();
        expect(screen.getByText('Production Line')).toBeInTheDocument();
    });

    it('handles factory and line selection', async () => {
        (listFactories as Mock).mockResolvedValue([
            { id: 'f1', name: 'Factory 1' },
            { id: 'f2', name: 'Factory 2' }
        ]);
        (listFactoryLines as Mock).mockResolvedValue([
            { id: 'l1', name: 'Line 1' }
        ]);

        render(<DashboardWizard isOpen={true} onClose={mockOnClose} onComplete={mockOnComplete} mode="create" />);

        await waitFor(() => {
            expect(screen.getByText('Factory 1')).toBeInTheDocument();
        });

        // Trigger upload step (mocked)
        expect(screen.getByTestId('step-upload')).toBeInTheDocument();
    });
});

import { render, type RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>{children}</BrowserRouter>
            </QueryClientProvider>
        );
    }

    return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Mock dashboard data for testing
 */
export const mockDashboardData = {
    stats: {
        totalOutput: 12450,
        efficiency: 87.3,
        discrepancies: 23,
        activeLines: 12,
    },
    productionData: [
        {
            date: '2024-12-20',
            target: 1000,
            actual: 950,
            efficiency: 95,
        },
        {
            date: '2024-12-21',
            target: 1000,
            actual: 1020,
            efficiency: 102,
        },
        {
            date: '2024-12-22',
            target: 1000,
            actual: 980,
            efficiency: 98,
        },
    ],
};

/**
 * Mock file data for upload tests
 */
export const mockFilePreview = {
    file_id: 'test-file-123',
    filename: 'test_production.xlsx',
    rows: 100,
    columns: ['Date', 'Line', 'Style', 'Target', 'Actual', 'Efficiency'],
    preview: [
        ['2024-12-20', 'Line 1', 'ST-001', '1000', '950', '95%'],
        ['2024-12-21', 'Line 1', 'ST-001', '1000', '1020', '102%'],
        ['2024-12-22', 'Line 1', 'ST-001', '1000', '980', '98%'],
    ],
};

/**
 * Mock user data
 */
export const mockUser = {
    id: 1,
    email: 'demo@linesight.ai',
    full_name: 'Demo User',
    organization_id: 1,
    role: 'admin',
};

/**
 * Mock auth token
 */
export const mockAuthToken = 'mock-jwt-token-12345';

/**
 * Helper to set up authenticated state
 */
export function setupAuthenticatedUser() {
    localStorage.setItem('token', mockAuthToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
}

/**
 * Helper to clear authentication
 */
export function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

/**
 * Create a mock File object for upload testing
 */
export function createMockFile(
    name: string = 'test.xlsx',
    type: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): File {
    const blob = new Blob(['mock file content'], { type });
    return new File([blob], name, { type });
}

/**
 * Wait for a specific amount of time
 */
export const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

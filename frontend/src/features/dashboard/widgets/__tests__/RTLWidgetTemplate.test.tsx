import React from 'react';
import { render, screen } from '@testing-library/react';
import RTLWidgetTemplate from '../RTLWidgetTemplate';
import { useTranslation } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- 1. Mocks ---
// Mock Lucide icons to verify class names directly
vi.mock('lucide-react', () => ({
    ArrowRight: ({ className, ...props }: any) => <div data-testid="arrow-right" className={className} {...props} />
}));

// Mock Recharts to avoid rendering complex SVG in unit tests
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    ComposedChart: ({ children }: any) => <div>{children}</div>,
    Bar: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
    useTranslation: vi.fn()
}));

// Mock useThemeColor
vi.mock('@/hooks/useThemeColor', () => ({
    useThemeColors: () => ({
        '--text-main': '#000',
        '--text-muted': '#666',
        '--border': '#ccc',
        '--surface': '#fff',
        '--color-primary': '#blue',
        '--color-danger': '#red'
    })
}));

describe('RTLWidgetTemplate', () => {
    const mockData = {
        data_points: [
            { label: 'A', value: 10 },
            { label: 'B', value: 20 }
        ]
    };
    const mockSettings = {
        customTitle: 'Test Widget'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should rotate ArrowRight icon 180 degrees in RTL mode', () => {
        // Setup RTL Environment
        (useTranslation as any).mockReturnValue({
            t: (key: string) => key,
            i18n: {
                dir: () => 'rtl',
                language: 'ar'
            }
        });

        render(
            <RTLWidgetTemplate
                data={mockData}
                settings={mockSettings}
                w={1}
                h={1}
                id="test-widget-rtl" // Using 'id' as per SmartWidgetProps
                isLoading={false}
                error={null}
                isMock={false}
                globalFilters={{
                    dateRange: { start: new Date(), end: new Date() }, // Verified: using 'start/end'
                    shift: 'all'
                }}
            />
        );

        const arrow = screen.getByTestId('arrow-right');
        expect(arrow.className).toContain('rotate-180');
    });

    it('should NOT rotate ArrowRight icon in LTR mode', () => {
        // Setup LTR Environment
        (useTranslation as any).mockReturnValue({
            t: (key: string) => key,
            i18n: {
                dir: () => 'ltr',
                language: 'en'
            }
        });

        render(
            <RTLWidgetTemplate
                data={mockData}
                settings={mockSettings}
                w={1}
                h={1}
                id="test-widget-ltr" // Using 'id' as per SmartWidgetProps
                isLoading={false}
                error={null}
                isMock={false}
                globalFilters={{
                    dateRange: { start: new Date(), end: new Date() }, // Verified: using 'start/end'
                    shift: 'all'
                }}
            />
        );

        const arrow = screen.getByTestId('arrow-right');
        expect(arrow.className).not.toContain('rotate-180');
    });
});

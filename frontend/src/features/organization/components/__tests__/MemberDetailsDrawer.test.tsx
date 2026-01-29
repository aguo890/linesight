
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { MemberDetailsDrawer } from '../MemberDetailsDrawer';
import type { MemberRead } from '../../../../api/endpoints/team/teamApi';

// Mock Lucide icons to avoid render issues in tests
vi.mock('lucide-react', () => ({
    X: () => <div data-testid="icon-x" />,
    Shield: () => <div data-testid="icon-shield" />,
    Factory: () => <div data-testid="icon-factory" />,
    AlertTriangle: () => <div data-testid="icon-alert" />,
}));

describe('MemberDetailsDrawer Smart Lookup', () => {
    const mockMember: MemberRead = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        avatar_url: null,
        role: 'manager',
        is_active: true,
        last_login: null,
        scopes: [
            {
                id: 'scope-1',
                production_line_id: 'line-uuid-1', // Matches context line
                role: 'manager',
                created_at: '2023-01-01'
            } as any,
            {
                id: 'scope-2',
                production_line_id: 'line-uuid-2', // Does NOT match context (External)
                role: 'manager',
                created_at: '2023-01-01'
            } as any
        ]
    };

    const mockContextLines = [
        {
            id: 'line-uuid-1',
            name: 'Main Assembly Line',
            code: 'L-01'
        }
    ];

    it('displays human-readable name for lines in context', () => {
        render(
            <MemberDetailsDrawer
                member={mockMember}
                isOpen={true}
                onClose={() => { }}
                contextLines={mockContextLines}
            />
        );

        // check for the human readable name
        expect(screen.getByText('Main Assembly Line')).toBeInTheDocument();

        // check for the code
        expect(screen.getByText('L-01')).toBeInTheDocument();

        // check for the "Current Factory" badge
        expect(screen.getByText('Current Factory')).toBeInTheDocument();
    });

    it('displays "External Line" fallback for lines NOT in context', () => {
        render(
            <MemberDetailsDrawer
                member={mockMember}
                isOpen={true}
                onClose={() => { }}
                contextLines={mockContextLines}
            />
        );

        // Should fallback to "External Line" + partial UUID
        // 'line-uuid-2'.slice(-4) is 'id-2'
        expect(screen.getByText(/External Line/)).toBeInTheDocument();
        expect(screen.getByText(/id-2/)).toBeInTheDocument();
    });
});


import { renderHook } from '@testing-library/react';
import { useFactoryFormat } from '../useFactoryFormat';
import { FactoryContext } from '../../contexts/FactoryContext';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import type { Factory } from '../../lib/factoryApi';

// Mock active factory generator
const createMockFactory = (settings: any = {}): Factory => ({
    id: 'test-factory',
    organization_id: 'org-1',
    name: 'Test Factory',
    is_active: true,
    settings: {
        timezone: 'UTC',
        date_format: 'MM/DD/YYYY',
        default_currency: 'USD',
        ...settings
    }
});

// Mock Context Wrapper
const createWrapper = (activeFactory: Factory | null) => {
    return ({ children }: { children: React.ReactNode }) => (
        <FactoryContext.Provider value={{
            factories: [],
            activeFactoryId: activeFactory?.id || null,
            activeFactory,
            setActiveFactoryId: vi.fn(),
            isLoading: false,
            error: null
        }}>
            {children}
        </FactoryContext.Provider>
    );
};

describe('useFactoryFormat', () => {
    it('should return default formatting when no factory is active', () => {
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(null) });

        // Defaults
        expect(result.current.dateFormat).toBe('MM/DD/YYYY');
        expect(result.current.timezone).toBe('UTC');
        expect(result.current.currency).toBe('USD');

        // Formatting
        const testDate = new Date('2024-01-01T12:00:00Z');
        expect(result.current.formatDate(testDate)).toBe('01/01/2024'); // default MM/DD/YYYY
        expect(result.current.formatCurrency(100)).toBe('$100.00'); // default USD
    });

    it('should respect factory timezone string updates', () => {
        // Factory in Tokyo (+9)
        const factory = createMockFactory({ timezone: 'Asia/Tokyo' });
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(factory) });

        const testDate = new Date('2024-01-01T12:00:00Z'); // 21:00 in Tokyo
        // Default format MM/DD/YYYY
        expect(result.current.formatDate(testDate, 'HH:mm')).toBe('21:00');
    });

    it('should respect date format preference (DD/MM/YYYY)', () => {
        const factory = createMockFactory({ date_format: 'DD/MM/YYYY' });
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(factory) });

        const testDate = new Date('2024-01-31T12:00:00Z');
        expect(result.current.formatDate(testDate)).toBe('31/01/2024');
    });

    it('should respect date format preference (YYYY-MM-DD)', () => {
        const factory = createMockFactory({ date_format: 'YYYY-MM-DD' });
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(factory) });

        const testDate = new Date('2024-01-31T12:00:00Z');
        expect(result.current.formatDate(testDate)).toBe('2024-01-31');
    });

    it('should respect currency preference (GBP)', () => {
        const factory = createMockFactory({ default_currency: 'GBP' });
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(factory) });

        // Intl formatting check
        const formatted = result.current.formatCurrency(1234.56);
        // Note: detailed currency symbol check might fail depending on node environment locale, but GBP usually standard
        expect(formatted).toContain('£');
        expect(formatted).toContain('1,234.56');
    });

    it('should respect currency preference (EUR)', () => {
        const factory = createMockFactory({ default_currency: 'EUR' });
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(factory) });

        const formatted = result.current.formatCurrency(1234.56);
        expect(formatted).toContain('€');
    });

    it('should handle invalid dates gracefully', () => {
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(null) });
        expect(result.current.formatDate(null)).toBe('-');
        expect(result.current.formatDate(undefined)).toBe('-');
    });

    it('should expose raw settings', () => {
        const settings = { custom_field: 'foo' };
        const factory = createMockFactory(settings);
        const { result } = renderHook(() => useFactoryFormat(), { wrapper: createWrapper(factory) });

        expect(result.current.settings).toBeDefined();
        expect((result.current.settings as any)?.custom_field).toBe('foo');
    });
});

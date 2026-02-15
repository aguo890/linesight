/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimezoneDate } from '../useTimezoneDate';
import { useFactories } from '../useFactory';

// Mock useFactories to control timezone
vi.mock('../useFactory', () => ({
    useFactories: vi.fn(),
}));

describe('useTimezoneDate', () => {
    // Mock active factory in tests
    const mockUseFactories = useFactories as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Set a fixed system time for testing "Now" behavior
        // let's pretend system is in UTC for simplicity of assertions, 
        // but the hook should handle system time being anything.
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('defaults to UTC when no factory is present', () => {
        mockUseFactories.mockReturnValue({ activeFactory: null });
        const { result } = renderHook(() => useTimezoneDate());
        expect(result.current.timeZone).toBe('UTC');
    });

    it('uses factory timezone when present', () => {
        mockUseFactories.mockReturnValue({ activeFactory: { timezone: 'Asia/Ho_Chi_Minh' } });
        const { result } = renderHook(() => useTimezoneDate());
        expect(result.current.timeZone).toBe('Asia/Ho_Chi_Minh');
    });

    it('falls back to UTC on invalid timezone', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        mockUseFactories.mockReturnValue({ activeFactory: { id: '1', timezone: 'Invalid/Place' } });

        const { result } = renderHook(() => useTimezoneDate());

        expect(result.current.timeZone).toBe('UTC');
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    // CRITICAL: Architecture Validation
    // Scenario: 
    // System Time: 2025-01-06 20:00:00 UTC (8 PM)
    // Factory: Asia/Ho_Chi_Minh (UTC+7)
    // Factory Time: 2025-01-07 03:00:00 (3 AM Next Day)
    // "Today" for Factory should be Jan 7th.
    it('correctly calculates "Today" for a factory ahead of system time', () => {
        // Set System Time to 2025-01-06T20:00:00Z
        const systemTime = new Date('2025-01-06T20:00:00Z');
        vi.setSystemTime(systemTime);

        mockUseFactories.mockReturnValue({ activeFactory: { timezone: 'Asia/Ho_Chi_Minh' } });
        const { result } = renderHook(() => useTimezoneDate());

        const startOfToday = result.current.getFactoryStartOfToday();

        // Expected: Jan 7th 00:00:00 Vietnam Time
        // = Jan 6th 17:00:00 UTC
        expect(startOfToday.toISOString()).toBe('2025-01-06T17:00:00.000Z');

        const endOfToday = result.current.getFactoryEndOfToday();
        // Expected: Jan 7th 23:59:59.999 Vietnam Time
        // = Jan 7th 16:59:59.999 UTC
        expect(endOfToday.toISOString()).toBe('2025-01-07T16:59:59.999Z');
    });

    // Scenario:
    // System Time: 2025-01-07 01:00:00 UTC
    // Factory: America/New_York (UTC-5)
    // Factory Time: 2025-01-06 20:00:00 (8 PM Prev Day)
    // "Today" for Factory should be Jan 6th.
    it('correctly calculates "Today" for a factory behind system time', () => {
        // Set System Time to 2025-01-07T01:00:00Z
        const systemTime = new Date('2025-01-07T01:00:00Z');
        vi.setSystemTime(systemTime);

        mockUseFactories.mockReturnValue({ activeFactory: { timezone: 'America/New_York' } });
        const { result } = renderHook(() => useTimezoneDate());

        const startOfToday = result.current.getFactoryStartOfToday();
        // Expected: Jan 6th 00:00:00 NY Time
        // = Jan 6th 05:00:00 UTC
        expect(startOfToday.toISOString()).toBe('2025-01-06T05:00:00.000Z');
    });

    it('converts factory date string to correct UTC start of day', () => {
        mockUseFactories.mockReturnValue({ activeFactory: { timezone: 'Asia/Ho_Chi_Minh' } });
        const { result } = renderHook(() => useTimezoneDate());

        // Input: "2025-01-07"
        // Target: 2025-01-07 00:00:00 Vietnam
        // UTC: 2025-01-06 17:00:00 UTC
        const utcDate = result.current.fromFactoryDateInputValue('2025-01-07');
        expect(utcDate?.toISOString()).toBe('2025-01-06T17:00:00.000Z');
    });

    it('converts absolute UTC to factory date string', () => {
        mockUseFactories.mockReturnValue({ activeFactory: { timezone: 'Asia/Ho_Chi_Minh' } });
        const { result } = renderHook(() => useTimezoneDate());

        // Input: 2025-01-06 23:00:00 UTC
        // Vietnam: 2025-01-07 06:00:00 
        // Expected String: "2025-01-07"
        const utcDate = new Date('2025-01-06T23:00:00Z');
        const str = result.current.toFactoryDateInputValue(utcDate);
        expect(str).toBe('2025-01-07');
    });

    it('subtracts days correctly respecting wall clock transitions', () => {
        // Test Crossing Midnight Boundary in UTC but not in Factory
        // Or simple subtraction
        mockUseFactories.mockReturnValue({ activeFactory: { timezone: 'Asia/Ho_Chi_Minh' } });
        const { result } = renderHook(() => useTimezoneDate());

        // Start: Jan 7th 00:00 VN (Jan 6th 17:00 UTC)
        const start = new Date('2025-01-06T17:00:00Z');

        // Subtract 1 day -> Jan 6th 00:00 VN (Jan 5th 17:00 UTC)
        const yesterday = result.current.subtractFactoryDays(start, 1);
        expect(yesterday.toISOString()).toBe('2025-01-05T17:00:00.000Z');
    });
});

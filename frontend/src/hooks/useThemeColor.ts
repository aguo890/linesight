/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useLayoutEffect, useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * SSR-safe useLayoutEffect.
 * Uses useLayoutEffect on client (zero-flicker), useEffect on server (no warning).
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Get a computed CSS variable value as an rgb() string.
 * Reacts to theme changes to trigger chart re-renders.
 * 
 * @param variableName - CSS variable name (e.g., '--text-main')
 * @returns rgb() formatted color string
 * 
 * @example
 * const gridColor = useThemeColor('--text-muted');
 * <CartesianGrid stroke={gridColor} />
 */
export function useThemeColor(variableName: string): string {
    const { resolvedTheme } = useTheme();
    // Default to transparent to prevent hydration mismatch
    const [color, setColor] = useState('rgba(0,0,0,0)');

    useIsomorphicLayoutEffect(() => {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(variableName)
            .trim();

        if (value) {
            // Robust parsing: "15 23 42" or "15  23   42" -> "15, 23, 42"
            const formatted = value.split(/\s+/).filter(Boolean).join(', ');
            setColor(`rgb(${formatted})`);
        }
    }, [variableName, resolvedTheme]);

    return color;
}

/**
 * Get multiple theme colors at once for performance.
 * Useful when a chart needs multiple coordinated colors.
 * 
 * @param variableNames - Array of CSS variable names
 * @returns Object mapping variable names to rgb() strings
 * 
 * @example
 * const { '--text-main': mainColor, '--text-muted': mutedColor } = useThemeColors(['--text-main', '--text-muted']);
 */
export function useThemeColors<T extends string>(variableNames: T[]): Record<T, string> {
    const { resolvedTheme } = useTheme();
    const [colors, setColors] = useState<Record<T, string>>(() => {
        const initial: Record<string, string> = {};
        variableNames.forEach(name => {
            initial[name] = 'rgba(0,0,0,0)';
        });
        return initial as Record<T, string>;
    });

    useIsomorphicLayoutEffect(() => {
        const style = getComputedStyle(document.documentElement);
        const newColors: Record<string, string> = {};

        variableNames.forEach(name => {
            const value = style.getPropertyValue(name).trim();
            if (value) {
                const formatted = value.split(/\s+/).filter(Boolean).join(', ');
                newColors[name] = `rgb(${formatted})`;
            } else {
                newColors[name] = 'rgba(0,0,0,0)';
            }
        });

        setColors(newColors as Record<T, string>);
    }, [resolvedTheme, ...variableNames]);

    return colors;
}

/**
 * Static helper for one-off color reads (non-reactive).
 * Use useThemeColor() instead when you need reactivity.
 */
export function getThemeColor(variableName: string): string {
    if (typeof window === 'undefined') return 'rgb(0, 0, 0)';

    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim();

    if (!value) return 'rgb(0, 0, 0)';

    const formatted = value.split(/\s+/).filter(Boolean).join(', ');
    return `rgb(${formatted})`;
}

/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Layout Utilities - Smart Widget Packing Algorithm
 * 
 * Implements a "First Fit Decreasing" bin-packing strategy for dashboard widgets.
 * Used by both the Wizard (initial layout) and MiniMap (preview).
 */

export interface LayoutItem {
    id: string;
    w: number;
    h: number;
    [key: string]: any; // Allow passing through other widget props
}

export interface LayoutPosition {
    x: number;
    y: number;
}

/**
 * Calculates a dense layout using a "First Fit Decreasing" strategy.
 * 
 * Algorithm:
 * 1. Sorts widgets by Height (DESC) then Width (DESC) - tall anchors first
 * 2. Scans the grid (left-to-right, top-to-bottom) for the first gap that fits
 * 3. Places widget and marks cells as occupied
 * 
 * @param items - Array of items with id, w (width), h (height) properties
 * @param cols - Number of grid columns (default: 12)
 * @returns Items with x, y positions calculated
 */
export const calculateSmartLayout = <T extends LayoutItem>(
    items: T[],
    cols: number = 12
): (T & LayoutPosition)[] => {
    if (items.length === 0) return [];

    // Clone and Sort: Taller first (anchors), then Wider (harder to place)
    const sorted = [...items].sort((a, b) => {
        if (b.h !== a.h) return b.h - a.h;
        return b.w - a.w;
    });

    // Track occupied cells using Set for O(1) lookup
    const occupied = new Set<string>();

    const isOccupied = (x: number, y: number, w: number, h: number): boolean => {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (occupied.has(`${x + dx},${y + dy}`)) return true;
            }
        }
        return false;
    };

    const markOccupied = (x: number, y: number, w: number, h: number): void => {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                occupied.add(`${x + dx},${y + dy}`);
            }
        }
    };

    const findFirstFit = (w: number, h: number): LayoutPosition => {
        let x = 0;
        let y = 0;
        const MAX_ROWS = 100; // Safety limit

        while (y < MAX_ROWS) {
            // If width exceeds cols at current x, wrap to next line
            if (x + w > cols) {
                x = 0;
                y++;
                continue;
            }

            if (!isOccupied(x, y, w, h)) {
                return { x, y };
            }

            x++;
        }

        // Fallback (should never reach with reasonable widget counts)
        return { x: 0, y: MAX_ROWS };
    };

    return sorted.map((item) => {
        const { x, y } = findFirstFit(item.w, item.h);
        markOccupied(x, y, item.w, item.h);
        return { ...item, x, y };
    });
};

/**
 * Get total rows used by a layout
 */
export const getLayoutHeight = (items: (LayoutItem & LayoutPosition)[]): number => {
    if (items.length === 0) return 0;
    return Math.max(...items.map(item => item.y + item.h));
};

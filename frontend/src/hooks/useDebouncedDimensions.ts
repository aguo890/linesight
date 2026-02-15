/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';

/**
 * Returns dimensions that only update after the specified delay.
 * Useful for preventing expensive re-renders during high-frequency resize events.
 * 
 * @param width - Current raw width
 * @param height - Current raw height
 * @param delay - Debounce delay in ms (default 200)
 */
export function useDebouncedDimensions(width: number, height: number, delay: number = 200) {
    const [dims, setDims] = useState({ width, height });

    useEffect(() => {
        // If delay is 0, update immediately (optimization for non-edit mode)
        if (delay === 0) {
            setDims({ width, height });
            return;
        }

        const handler = setTimeout(() => {
            setDims({ width, height });
        }, delay);

        return () => clearTimeout(handler);
    }, [width, height, delay]);

    return dims;
}

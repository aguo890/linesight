/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useState, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Returns the width of a container with performance optimizations for animations.
 * * Google RAIL Optimization: "Animation" phase.
 * Prevents ResizeObserver from trashing the main thread during CSS transitions 
 * by using a ref-based pause mechanism and a scheduled catch-up snap.
 * 
 * @param ref - React ref of the container element
 * @param isPaused - Whether to pause width updates (prevents state updates & re-renders)
 */
export function useContainerWidth(ref: React.RefObject<HTMLElement | null>, isPaused: boolean = false) {
    const [width, setWidth] = useState(0);
    const [mounted, setMounted] = useState(false);

    // PERFORMANCE FIX: Use a ref for the paused state.
    // This allows us to check the value inside the Observer callback 
    // without adding 'isPaused' to the useEffect dependency array,
    // which would cause the Observer to disconnect/reconnect unnecessarily.
    const pausedRef = useRef(isPaused);

    // Keep the ref in sync immediately
    useLayoutEffect(() => {
        pausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        setMounted(true);
        if (!ref.current) return;

        // Initial measure
        setWidth(ref.current.offsetWidth);

        const observer = new ResizeObserver((entries) => {
            // RAIL OPTIMIZATION: Return early if paused.
            // This keeps the observer alive but idle during the transition.
            if (pausedRef.current) return;

            if (!entries || !entries.length) return;

            const contentRect = entries[0].contentRect;

            // Optimization: Prevent state update if value hasn't effectively changed
            setWidth((prev) => {
                if (Math.abs(prev - contentRect.width) < 1) return prev;
                return contentRect.width;
            });
        });

        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [ref]); // Dependency is strictly 'ref', ensuring Observer persists.

    // PERFORMANCE FIX: The "Catch-Up" Mechanism
    // When we unpause, the ResizeObserver might have missed the final dimension change.
    // We force a measurement aligned with the next animation frame.
    useLayoutEffect(() => {
        if (!isPaused && ref.current) {
            requestAnimationFrame(() => {
                if (ref.current) {
                    setWidth(ref.current.getBoundingClientRect().width);
                }
            });
        }
    }, [isPaused, ref]);

    return {
        width,
        containerRef: ref,
        mounted
    };
}

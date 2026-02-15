/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useSpring, useTransform, MotionValue } from 'framer-motion';

interface SnakeLaneProps {
    progress: MotionValue<number>;
    isDark?: boolean;
}

export const SnakeLane: React.FC<SnakeLaneProps> = ({ progress, isDark = false }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);

    // 1. Robust Height Calculation
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            // Use contentRect for precise sub-pixel measurements
            const entry = entries[0];
            if (entry) {
                setHeight(entry.contentRect.height);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // 2. Configuration
    const w = 100; // Viewport width (0-100 coordinate space)
    const center = w / 2;

    // 3. Define Waypoints to align with your Bento Grid
    // These specific Y percentages align with the gap-96 spacing in your layout
    const points = useMemo(() => [
        { x: center, y: 0 },      // Start
        { x: 9, y: 0.18 },    // Align with "Kill Spreadsheets" (Left)
        { x: 91, y: 0.48 },   // Align with "ERP Alternative" (Right)
        { x: 9, y: 0.78 },    // Align with "Accountability" (Left)
        { x: center, y: 1.0 },    // End
    ], []);

    // 4. Generate Smooth Bezier Path
    const pathD = useMemo(() => {
        if (height === 0) return "";

        // Scale Y percentages to actual pixels
        const p = points.map(pt => ({ x: pt.x, y: pt.y * height }));

        let d = `M ${p[0].x} ${p[0].y}`;

        for (let i = 0; i < p.length - 1; i++) {
            const curr = p[i];
            const next = p[i + 1];

            // Calculate Control Points for a "S" curve
            // We use 50% of the vertical distance as the curvature handle
            const distY = next.y - curr.y;
            const cp1 = { x: curr.x, y: curr.y + (distY * 0.5) };
            const cp2 = { x: next.x, y: next.y - (distY * 0.5) };

            d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
        }
        return d;
    }, [height, points]);

    // 5. Physics Smoothing
    const smoothProgress = useSpring(progress, {
        stiffness: 60,
        damping: 20,
        restDelta: 0.001
    });

    const pathLength = useTransform(smoothProgress, [0, 0.95], [0, 1]);
    const opacity = useTransform(smoothProgress, [0, 0.1], [0, 1]);

    return (
        <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none">
            <svg
                viewBox={`0 0 ${w} ${height}`}
                fill="none"
                preserveAspectRatio="none"
                className="w-full h-full overflow-visible"
            >
                <defs>
                    {/* The Circuit Gradient */}
                    <linearGradient id="circuit-gradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                        <stop offset="20%" stopColor="#60a5fa" /> {/* Blue-400 */}
                        <stop offset="50%" stopColor="#2dd4bf" /> {/* Teal-400 */}
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>

                    {/* Neon Glow Filter */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* 1. Background Track (Dashed) */}
                <path
                    d={pathD}
                    stroke={isDark ? "#334155" : "#cbd5e1"}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="4 6"
                    strokeLinecap="round"
                />

                {/* 2. Anchor Nodes (The dots at the turns) */}
                {points.map((pt, i) => (
                    <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y * height}
                        r={isDark ? 3 : 2}
                        fill={isDark ? "#1e293b" : "#fff"}
                        stroke={isDark ? "#334155" : "#cbd5e1"}
                        strokeWidth="2"
                    />
                ))}

                {/* 3. The Active Beam */}
                <motion.path
                    d={pathD}
                    stroke="url(#circuit-gradient)"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    style={{
                        opacity,
                        pathLength: pathLength,
                    }}
                />
            </svg>
        </div>
    );
};

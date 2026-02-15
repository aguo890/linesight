/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { type ReactNode } from 'react';

interface ChartDirectionIsolatorProps {
    children: ReactNode;
    className?: string;
}

/**
 * Enforces LTR layout for data visualization components, regardless of app locale.
 * This prevents axis inversion and coordinate corruption in RTL mode.
 */
export const ChartDirectionIsolator: React.FC<ChartDirectionIsolatorProps> = ({
    children,
    className = ''
}) => {
    return (
        <div
            className={className}
            style={{
                direction: 'ltr',
                textAlign: 'left',
                width: '100%',
                height: '100%'
            }}
            dir="ltr"
        >
            {children}
        </div>
    );
};

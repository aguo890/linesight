/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutoFlipIconProps extends LucideProps {
    icon: LucideIcon;
    shouldFlip?: boolean;
}

/**
 * A wrapper for Lucide icons that automatically applies RTL rotation (180 degrees)
 * for directional icons (e.g., arrows, chevrons).
 */
export const AutoFlipIcon: React.FC<AutoFlipIconProps> = ({
    icon: Icon,
    shouldFlip = true,
    className,
    ...props
}) => {
    return (
        <Icon
            className={cn(
                className,
                shouldFlip && "rtl:rotate-180 transition-transform"
            )}
            {...props}
        />
    );
};

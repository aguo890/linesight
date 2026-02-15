/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RightSidebarShellProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    zIndex?: string;
    width?: string;
}

export const RightSidebarShell: React.FC<RightSidebarShellProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    zIndex = "z-[9999]",
    width = "w-80"
}) => {
    return (
        <div className={cn(
            "fixed inset-y-0 end-0 bg-surface shadow-xl border-inline-start border-border flex flex-col transform transition-transform duration-300 ease-in-out",
            width,
            zIndex,
            isOpen ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
        )}>
            {/* Header */}
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface-subtle">
                <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight text-text-main uppercase truncate">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider truncate">
                            {subtitle}
                        </p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-surface-active rounded-full transition-colors shrink-0"
                >
                    <X size={20} className="text-text-muted" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className="p-6 border-t border-border bg-surface-subtle">
                    {footer}
                </div>
            )}
        </div>
    );
};

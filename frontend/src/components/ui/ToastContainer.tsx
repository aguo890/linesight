/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import type { Toast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role="alert"
                    className={cn(
                        "pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border animate-slideInRight",
                        "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100",
                        toast.type === 'success' && "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800",
                        toast.type === 'error' && "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800",
                        toast.type === 'warning' && "border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800",
                        toast.type === 'info' && "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800"
                    )}
                >
                    <div className="shrink-0 mt-0.5">
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                        {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                    </div>

                    <div className="flex-1 text-sm font-medium">
                        {toast.message}
                    </div>

                    <button
                        onClick={() => onRemove(toast.id)}
                        className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                    >
                        <X className="w-4 h-4" />
                        <span className="sr-only">Close</span>
                    </button>
                </div>
            ))}
        </div>,
        document.body
    );
};

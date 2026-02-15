/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'default' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'default',
    size = 'md',
    loading = false,
    className = '',
    disabled,
    ...props
}) => {
    // Base styles (using tailwind primitives available in project)
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';

    // Map variants to specific styles
    const variants = {
        primary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white focus:ring-[var(--color-primary)]',
        default: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white focus:ring-[var(--color-primary)]',
        secondary: 'bg-slate-700 hover:bg-slate-600 text-white focus:ring-slate-500',
        danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500',
        ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-500',
        outline: 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-900 focus:ring-slate-500',
    };

    const sizes = {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 py-2 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9 p-0',
    };

    const variantStyles = variants[variant] || variants.default;
    const sizeStyles = sizes[size] || sizes.md;

    return (
        <button
            className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className} ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                </span>
            ) : children}
        </button>
    );
};

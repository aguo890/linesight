import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background';

    const variants = {
        primary: 'bg-primary hover:bg-primary/90 text-white focus:ring-primary',
        secondary: 'bg-slate-700 hover:bg-slate-600 text-white focus:ring-slate-500',
        danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500',
        ghost: 'bg-transparent hover:bg-slate-700 text-slate-300 focus:ring-slate-500',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

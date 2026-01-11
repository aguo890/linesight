import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-text-main mb-2">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`w-full px-4 py-2.5 bg-surface border rounded-lg text-text-main placeholder-text-muted 
                   focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                   ${error ? 'border-error' : 'border-border'}
                   ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-error">{error}</p>}
            {helperText && !error && <p className="mt-1 text-sm text-text-muted">{helperText}</p>}
        </div>
    );
};

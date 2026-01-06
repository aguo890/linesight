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
                <label htmlFor={inputId} className="block text-sm font-medium text-slate-300 mb-2">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`w-full px-4 py-2.5 bg-slate-800 border rounded-lg text-white placeholder-slate-500 
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                   ${error ? 'border-red-500' : 'border-slate-600'}
                   ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
            {helperText && !error && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
        </div>
    );
};

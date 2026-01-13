import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import logo from '../../assets/images/logo.png';

// Helper for Tailwind class merging
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface LogoProps {
    variant?: 'marketing' | 'app' | 'auth' | 'footer';
    className?: string; // For positioning the container
    imgClassName?: string;
    textClassName?: string; // Optional manual overrides
    opacity?: number;
    stacked?: boolean; // Text below image, centered
    showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
    variant = 'app',
    className = "",
    imgClassName = "",
    textClassName = "",
    opacity,
    stacked = false,
    showText = true
}) => {
    // Define styles for each context
    const variants = {
        marketing: {
            text: "text-xl font-semibold tracking-tight text-slate-900 dark:text-white transition-colors duration-300",
            img: "h-7 w-auto mix-blend-multiply dark:mix-blend-normal",
            container: "gap-2"
        },
        app: {
            text: "text-base font-semibold tracking-tight text-[var(--color-text)]",
            img: "h-6 w-auto mix-blend-multiply dark:mix-blend-normal dark:",
            container: "gap-2"
        },
        auth: {
            text: "text-2xl font-semibold tracking-tight text-text-main transition-colors duration-300",
            img: "h-12 w-auto dark:brightness-125",
            container: "gap-3"
        },
        footer: {
            text: "text-lg font-semibold tracking-tight text-slate-900 dark:text-white transition-colors duration-300",
            img: "h-8 w-auto mix-blend-multiply dark:mix-blend-normal",
            container: "gap-2"
        }
    };

    const currentVariant = variants[variant];

    // Stacked layout: vertical with centered content
    const containerClasses = stacked
        ? cn("flex flex-col items-center justify-center", currentVariant.container, className)
        : cn("flex items-center", currentVariant.container, className);

    return (
        <div
            className={containerClasses}
            style={opacity !== undefined ? { opacity } : undefined}
        >
            <img
                src={logo}
                alt="LineSight Logo"
                className={cn(currentVariant.img, imgClassName)}
            />
            {showText && (
                <span className={cn(currentVariant.text, textClassName)}>
                    Line<span className="text-brand">Sight</span>
                </span>
            )}
        </div>
    );
};

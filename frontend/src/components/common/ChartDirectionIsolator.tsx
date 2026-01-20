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

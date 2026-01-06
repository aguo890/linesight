import React from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

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
            "fixed inset-y-0 right-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out",
            width,
            zIndex,
            isOpen ? "translate-x-0" : "translate-x-full"
        )}>
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight text-slate-800 uppercase truncate">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
                            {subtitle}
                        </p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-200/50 rounded-full transition-colors shrink-0"
                >
                    <X size={20} className="text-slate-500" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    {footer}
                </div>
            )}
        </div>
    );
};

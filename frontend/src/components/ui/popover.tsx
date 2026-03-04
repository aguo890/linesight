/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const PopoverContext = React.createContext<{
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
} | null>(null);

export const Popover: React.FC<PopoverProps> = ({ children, open, onOpenChange }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : uncontrolledOpen;
    const setIsOpen = (newOpen: boolean) => {
        if (!isControlled) setUncontrolledOpen(newOpen);
        onOpenChange?.(newOpen);
    };

    return (
        <PopoverContext.Provider value={{ isOpen, setIsOpen }}>
            <div className="relative inline-block text-left">
                {children}
            </div>
        </PopoverContext.Provider>
    );
};

/**
 * Utility to merge refs safely.
 */
function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
    return (value: T) => {
        refs.forEach((ref) => {
            if (typeof ref === 'function') {
                ref(value);
            } else if (ref != null) {
                (ref as React.MutableRefObject<T | null>).current = value;
            }
        });
    };
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    ref?: React.Ref<HTMLButtonElement>;
}

export const PopoverTrigger = ({ children, asChild, onClick, ref, ...props }: PopoverTriggerProps) => {
    const context = React.useContext(PopoverContext);
    if (!context) throw new Error("PopoverTrigger must be used within Popover");

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        context.setIsOpen(!context.isOpen);
    };

    if (asChild && React.isValidElement(children)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const childRef = (children as any).ref;

        return React.cloneElement(children as React.ReactElement<any>, {
            ...props,
            onClick: handleClick,
            // eslint-disable-next-line react-hooks/refs
            ref: mergeRefs(ref, childRef)
        });
    }

    return (
        <button ref={ref} onClick={handleClick} {...props}>
            {children}
        </button>
    );
};
PopoverTrigger.displayName = "PopoverTrigger";

export const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { side?: 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end' }>(
    ({ className, children, side = 'bottom', ...props }, ref) => {
        const context = React.useContext(PopoverContext);
        if (!context) throw new Error("PopoverContent must be used within Popover");


        // Handle click outside


        // Simpler close on outside click:
        useEffect(() => {
            if (!context.isOpen) return;

            const handleGlobalClick = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                // If click is inside the popover (trigger or content), ignore.
                // We need a ref to the container.
                // Since we don't have it easily here, we'll try to use a data attribute or class.
                if (target.closest('.relative.inline-block.text-left')) return;
                context.setIsOpen(false);
            };

            document.addEventListener('mousedown', handleGlobalClick);
            return () => document.removeEventListener('mousedown', handleGlobalClick);
        }, [context.isOpen, context]);

        if (!context.isOpen) return null;

        return (
            <div
                ref={ref}
                className={cn(
                    "absolute z-50 mt-2 rounded-md border border-border bg-surface shadow-md outline-none animate-in fade-in-0 zoom-in-95",
                    side === 'top' && "bottom-full mb-2 mt-0",
                    side === 'bottom' && "top-full",
                    side === 'right' && "left-full top-0 ml-2 mt-0",
                    side === 'left' && "right-full top-0 mr-2 mt-0",
                    side === 'start' && "end-full top-0 me-2 mt-0",
                    side === 'end' && "start-full top-0 ms-2 mt-0",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);
PopoverContent.displayName = "PopoverContent";

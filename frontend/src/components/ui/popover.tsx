import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

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

export const PopoverTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
    ({ children, asChild, onClick, ...props }, ref) => {
        const context = React.useContext(PopoverContext);
        if (!context) throw new Error("PopoverTrigger must be used within Popover");

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            onClick?.(e);
            context.setIsOpen(!context.isOpen);
        };

        if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children as React.ReactElement<any>, {
                onClick: handleClick,
                ref,
                ...props
            });
        }

        return (
            <button ref={ref} onClick={handleClick} {...props}>
                {children}
            </button>
        );
    }
);
PopoverTrigger.displayName = "PopoverTrigger";

export const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { side?: 'top' | 'bottom' | 'left' | 'right' }>(
    ({ className, children, side = 'bottom', ...props }, ref) => {
        const context = React.useContext(PopoverContext);
        if (!context) throw new Error("PopoverContent must be used within Popover");
        const popoverRef = useRef<HTMLDivElement>(null);

        // Handle click outside
        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (context.isOpen && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                    // Ensure we didn't click the trigger (handled by structure usually, but safe to check)
                    // Simplified: relying on event bubbling check or basic contains
                    // For now, close if click is strictly outside content. 
                    // Trigger click toggles, so if we click trigger, this might fire first or after. 
                    // With inline, trigger is sibling. 
                    // Let's rely on a simpler 'click outside' on the document specifically checking the entire popover root if we could, 
                    // but here we only have ref to content. 
                    // We will defer 'close on outside click' to the parent Popover container or similar if needed.
                    // Actually, for this simple implementation, 'close on click outside' is tricky without a global listener.
                    // I'll add a global listener here.
                }
            };
            // document.addEventListener('mousedown', handleClickOutside);
            // return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [context.isOpen]);

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
                ref={popoverRef}
                className={cn(
                    "absolute z-50 mt-2 rounded-md border bg-white shadow-md outline-none animate-in fade-in-0 zoom-in-95",
                    side === 'top' && "bottom-full mb-2 mt-0",
                    side === 'bottom' && "top-full",
                    side === 'right' && "left-full top-0 ml-2 mt-0",
                    side === 'left' && "right-full top-0 mr-2 mt-0",
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

import React from 'react';
import { cn } from '@/lib/utils';

// --- Composed Components (Shadcn-style) ---

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-lg border border-border bg-surface text-text-main shadow-sm",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-2xl font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-text-muted dark:text-text-muted", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

// --- Legacy Wrapper for Backward Compatibility ---
// If code uses <Card title="..."> it will fall back to this behavior
// We can't easily overload the 'Card' export if it's a component.
// NOTE: The previous Card was a named export `export const Card`. 
// The new Card is also `const Card`, but we need to satisfy the old props if possible?
// Actually, standard Shadcn 'Card' just takes children. 
// If existing code uses `title` prop on `Card`, we need to inspect `props` in the main Card or create a compatibility wrapper.

// Let's inspect what the OLD Card did.
// It took `title`, `subtitle`, `action`.
// We should check if we can support both.

// Hack: We can make a SmartCard that renders standard div if children only, 
// or renders header if title prop exists.

interface LegacyCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    subtitle?: string;
    action?: React.ReactNode;
}

const SmartCard = React.forwardRef<HTMLDivElement, LegacyCardProps>(({ className, title, subtitle, action, children, ...props }, ref) => {
    // If legacy props are present, render the legacy structure inside the new Card styling
    if (title || subtitle || action) {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-lg border border-border bg-surface text-text-main shadow-sm",
                    className
                )}
                {...props}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border">
                    <div>
                        {title && <h3 className="font-semibold text-text-main">{title}</h3>}
                        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
                <div className="p-4">{children}</div>
            </div>
        );
    }

    // Otherwise render standard Shadcn card
    return (
        <div
            ref={ref}
            className={cn(
                "rounded-lg border border-border bg-surface text-text-main shadow-sm",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});
SmartCard.displayName = "Card";

export { SmartCard as Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

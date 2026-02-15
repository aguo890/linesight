/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useState, useContext, createContext } from 'react';
import { cn } from '@/lib/utils';

const AvatarContext = createContext<{
    imageLoadingStatus: 'loading' | 'loaded' | 'error';
    onImageLoadingStatusChange: (status: 'loading' | 'loaded' | 'error') => void;
} | null>(null);

// Avatar Root
const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
        return (
            <AvatarContext.Provider value={{ imageLoadingStatus: status, onImageLoadingStatusChange: setStatus }}>
                <div
                    ref={ref}
                    className={cn(
                        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
                        className
                    )}
                    {...props}
                />
            </AvatarContext.Provider>
        );
    }
);
Avatar.displayName = "Avatar";

// Avatar Image
const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
    ({ className, src, ...props }, ref) => {
        const context = useContext(AvatarContext);

        // If no src provided, immediately set error status to show fallback
        React.useLayoutEffect(() => {
            if (!src && context?.imageLoadingStatus !== 'error') {
                context?.onImageLoadingStatusChange('error');
            }
        }, [src, context]);

        if (context?.imageLoadingStatus === 'error') return null;

        return (
            <img
                ref={ref}
                src={src}
                onLoad={() => context?.onImageLoadingStatusChange('loaded')}
                onError={() => context?.onImageLoadingStatusChange('error')}
                className={cn("aspect-square h-full w-full", className)}
                {...props}
            />
        );
    }
);
AvatarImage.displayName = "AvatarImage";

// Avatar Fallback
const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        const context = useContext(AvatarContext);

        // Only render if image has error or is still loading (optional: show fallback while loading)
        // Usually we want fallback if image is broken. 
        // If I return slightly null, it might flicker. 
        // Let's render always if strict layout match, but logical hiding is safer.
        // Radix: Render if status !== 'loaded'.
        if (context?.imageLoadingStatus === 'loaded') return null;

        return (
            <div
                ref={ref}
                className={cn(
                    "flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground dark:text-white",
                    className
                )}
                {...props}
            />
        );
    }
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };

import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface WidgetSkeletonProps {
    className?: string;
}

export const WidgetSkeleton: React.FC<WidgetSkeletonProps> = ({ className }) => {
    return (
        <div className={cn("flex flex-col h-full w-full p-4 gap-4 bg-surface/50 rounded-lg border border-border/50", className)}>
            {/* Header Simulation */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-20 opacity-70" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>

            {/* Content Simulation */}
            <div className="flex-1 w-full min-h-0">
                <Skeleton className="h-full w-full rounded-md" />
            </div>
        </div>
    );
};

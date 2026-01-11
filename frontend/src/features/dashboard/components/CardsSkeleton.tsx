import React from 'react';
import { Skeleton } from '../../../components/ui/Skeleton';

interface CardsSkeletonProps {
    count?: number;
    viewMode?: 'grid' | 'list';
}

export const CardsSkeleton: React.FC<CardsSkeletonProps> = ({ count = 3, viewMode = 'grid' }) => {
    const items = Array.from({ length: count });

    if (viewMode === 'list') {
        return (
            <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-surface-subtle flex gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <div className="flex-1" />
                    <Skeleton className="h-4 w-12" />
                </div>
                <div className="divide-y divide-border">
                    {items.map((_, i) => (
                        <div key={i} className="p-4 flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-48 mb-2" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-8 w-8 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((_, i) => (
                <div key={i} className="bg-surface rounded-xl border border-border p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <Skeleton className="h-6 w-6 rounded" />
                    </div>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-6" />

                    <div className="pt-4 border-t border-border flex justify-between items-center">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-4 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
};
